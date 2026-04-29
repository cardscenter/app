// Bulk + single-card sync helpers — call from cron routes or manual scripts.

import { prisma } from "@/lib/prisma";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
import { fetchAllPagesForSet, fetchSetViaCardLookup, getCard } from "./client";
import {
  isSealedProduct,
  isVariantPattern,
  mapPatternVariantPricing,
  mapPokewalletPricing,
  normalizeCardNumber,
  type PatternVariantPricing,
} from "./pricing";
import { GALLERY_SUBSET_MAPPING, type GallerySubset } from "./set-mapping";
import type { PokewalletCard } from "./types";

/**
 * Retry-loop voor SQLite locks. Treedt op als de dev-server tegelijk leest:
 * we zien dan SQLITE_BUSY of SocketTimeout. Backoff start op 250ms.
 */
async function withRetry<T>(op: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let delay = 250;
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await op();
    } catch (e: unknown) {
      const err = e as { code?: string; meta?: { driverAdapterError?: unknown } };
      const isLock = err.code === "SQLITE_BUSY" || err.code === "P1008" || /SocketTimeout|database is locked/i.test(String(e));
      if (!isLock || i === maxAttempts - 1) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 4000);
    }
  }
  throw lastErr;
}

interface SyncResult {
  setId: string;
  setName: string;
  pokewalletReturned: number;
  matched: number;
  updated: number;
  unmatched: number;
  variantsSkipped: number;
  sealedSkipped: number;
  fallbackUsed: boolean;
}

/**
 * Refresh all card prices for a single CardSet.
 * Requires CardSet.pokewalletSetId to be set.
 */
export async function syncSetByPokewalletId(cardSetId: string): Promise<SyncResult> {
  const set = await withRetry(() =>
    prisma.cardSet.findUnique({
      where: { id: cardSetId },
      select: { id: true, name: true, pokewalletSetId: true },
    }),
  );
  if (!set?.pokewalletSetId) {
    throw new Error(`CardSet ${cardSetId} has no pokewalletSetId mapping`);
  }

  let pwCards = await fetchAllPagesForSet(set.pokewalletSetId);
  let fallbackUsed = false;
  if (pwCards.length === 0) {
    // /search returned nothing — typical for brand-new sets not yet indexed.
    // Fall back to /sets endpoint + per-card /cards/:id lookup.
    pwCards = await fetchSetViaCardLookup(set.pokewalletSetId);
    fallbackUsed = true;
  }

  const dbCards = await withRetry(() =>
    prisma.card.findMany({
      where: { cardSetId: set.id },
      select: {
        id: true, localId: true, name: true, pokewalletId: true, rarity: true,
        priceOverrideAvg: true, priceOverrideReverseAvg: true,
      },
    }),
  );

  // Group PW cards by normalized card_number, exclude sealed.
  // Pattern-variants (Master Ball / Poke Ball etc) gaan in een aparte map en
  // landen straks als JSON-blob op de basis-card.
  const pwByNum = new Map<string, PokewalletCard[]>();
  const patternsByNum = new Map<string, PatternVariantPricing[]>();
  let variantsSkipped = 0;
  let sealedSkipped = 0;
  for (const pw of pwCards) {
    if (isSealedProduct(pw.card_info.name, pw.card_info.card_number)) {
      sealedSkipped++;
      continue;
    }
    const num = normalizeCardNumber(pw.card_info.card_number);
    if (isVariantPattern(pw.card_info.name)) {
      variantsSkipped++;
      const variant = mapPatternVariantPricing(pw);
      if (variant && variant.tcgUsd != null && variant.tcgUsd > 0) {
        if (!patternsByNum.has(num)) patternsByNum.set(num, []);
        patternsByNum.get(num)!.push(variant);
      }
      continue;
    }
    if (!pwByNum.has(num)) pwByNum.set(num, []);
    pwByNum.get(num)!.push(pw);
  }

  let matched = 0;
  let unmatched = 0;
  const today = todayUtc();
  // Verzamel raw data ipv pre-built PrismaPromises — die kunnen niet
  // hergebruikt worden binnen een retry-loop.
  type CardUpdate = {
    dbCardId: string;
    pwId: string;
    claimed: boolean;
    pricing: ReturnType<typeof mapPokewalletPricing>;
    priceVariantsJson: string | null;
    rarity: string | null;
    priceOverrideAvg: number | null;
    priceOverrideReverseAvg: number | null;
  };
  const pendingUpdates: CardUpdate[] = [];

  // Track pokewalletIds we've claimed in THIS sync to avoid two DB cards
  // (e.g. duplicate set rows or accidental name-collisions) racing for the
  // same pokewallet card record. Pre-fill with IDs already used elsewhere
  // in the DB so we don't trip the unique constraint.
  const claimedPwIds = new Set<string>();
  const existingMappings = await withRetry(() =>
    prisma.card.findMany({
      where: { pokewalletId: { not: null }, cardSetId: { not: set.id } },
      select: { pokewalletId: true },
    }),
  );
  for (const m of existingMappings) if (m.pokewalletId) claimedPwIds.add(m.pokewalletId);

  for (const dbCard of dbCards) {
    const num = normalizeCardNumber(dbCard.localId);
    const rawCandidates = pwByNum.get(num) ?? [];
    if (rawCandidates.length === 0) {
      unmatched++;
      continue;
    }

    // Sort: candidates without parenthetical-modifiers first (e.g. "Eevee - 173"
    // before "Eevee - 173 (Pokemon Center Exclusive)"), then by name length so
    // the most "plain" name wins. Prevents promo-sets accidentally mapping to
    // the special-edition variant when both share the same card_number.
    const candidates = [...rawCandidates].sort((a, b) => {
      const aHasParen = a.card_info.name.includes("(");
      const bHasParen = b.card_info.name.includes("(");
      if (aHasParen !== bHasParen) return aHasParen ? 1 : -1;
      return a.card_info.name.length - b.card_info.name.length;
    });

    let pw = candidates.find(
      (c) => c.card_info.name === dbCard.name && (c.cardmarket?.prices?.length ?? 0) > 0,
    );
    if (!pw)
      pw = candidates.find(
        (c) => c.card_info.name.includes(num) && (c.cardmarket?.prices?.length ?? 0) > 0,
      );
    if (!pw) pw = candidates.find((c) => (c.cardmarket?.prices?.length ?? 0) > 0);
    pw ??= candidates[0];

    matched++;
    const pricing = mapPokewalletPricing(pw);

    // If this pokewalletId is already claimed by another card, skip the
    // pwId update but still apply pricing — pricing comes from the same
    // CardMarket product anyway.
    const pwIdAlreadyClaimed = claimedPwIds.has(pw.id);
    if (!pwIdAlreadyClaimed) claimedPwIds.add(pw.id);

    // Pattern-variants behoren bij dit kaartnummer? Sla op als JSON-blob.
    const patternList = patternsByNum.get(num);
    const priceVariantsJson = patternList && patternList.length > 0 ? JSON.stringify(patternList) : null;

    pendingUpdates.push({
      dbCardId: dbCard.id,
      pwId: pw.id,
      claimed: pwIdAlreadyClaimed,
      pricing,
      priceVariantsJson,
      rarity: dbCard.rarity,
      priceOverrideAvg: dbCard.priceOverrideAvg,
      priceOverrideReverseAvg: dbCard.priceOverrideReverseAvg,
    });
  }

  // Run in batched transactions to avoid SQLite lock contention.
  // Bouw queries opnieuw op binnen elke retry — PrismaPromises kunnen niet
  // hergebruikt worden na een failed transaction.
  const BATCH = 25;
  for (let i = 0; i < pendingUpdates.length; i += BATCH) {
    const batch = pendingUpdates.slice(i, i + BATCH);
    await withRetry(() =>
      prisma.$transaction([
        ...batch.map((u) => {
          const data = u.claimed
            ? { ...u.pricing, priceVariantsJson: u.priceVariantsJson }
            : { pokewalletId: u.pwId, ...u.pricing, priceVariantsJson: u.priceVariantsJson };
          return prisma.card.update({ where: { id: u.dbCardId }, data });
        }),
        ...batch.map((u) => {
          // Snapshot the blended Marktprijs (not raw priceAvg) so the chart
          // shows real daily movement while staying aligned with the UI's
          // displayed market value. Manual overrides are applied inside
          // getMarktprijs so snapshots match the displayed value exactly.
          const snapNormal = getMarktprijs({
            ...u.pricing,
            rarity: u.rarity,
            priceOverrideAvg: u.priceOverrideAvg,
          });
          const snapReverse = getMarktprijsReverseHolo({
            ...u.pricing,
            priceOverrideReverseAvg: u.priceOverrideReverseAvg,
          });
          return prisma.cardPriceHistory.upsert({
            where: { cardId_date: { cardId: u.dbCardId, date: today } },
            create: {
              cardId: u.dbCardId,
              date: today,
              priceNormal: snapNormal,
              priceReverse: snapReverse,
            },
            update: {
              priceNormal: snapNormal,
              priceReverse: snapReverse,
            },
          });
        }),
      ]),
    );
  }

  // If this parent set has a gallery sub-set (Trainer Gallery / Galarian
  // Gallery) in pokewallet, sync those prefixed cards too. They live in the
  // SAME DB CardSet with a "TG"/"GG" prefix, while pokewallet tracks them
  // under a separate set_id.
  const gallery = await getGallerySubsetForSet(set.id);
  const gResult = gallery
    ? await syncGallerySubset(set.id, gallery)
    : { matched: 0, unmatched: 0 };

  return {
    setId: set.id,
    setName: set.name,
    pokewalletReturned: pwCards.length,
    matched: matched + gResult.matched,
    updated: matched + gResult.matched,
    unmatched: unmatched + gResult.unmatched,
    variantsSkipped,
    sealedSkipped,
    fallbackUsed,
  };
}

/**
 * Look up the gallery sub-set (TG / GG) for a given parent CardSet based on
 * its tcgdexSetId. Returns null if no gallery sub-set exists for this set.
 */
async function getGallerySubsetForSet(cardSetId: string): Promise<GallerySubset | null> {
  const set = await prisma.cardSet.findUnique({
    where: { id: cardSetId },
    select: { tcgdexSetId: true },
  });
  if (!set?.tcgdexSetId) return null;
  return GALLERY_SUBSET_MAPPING[set.tcgdexSetId] ?? null;
}

/**
 * Sync gallery-prefix cards (TG / GG) in a parent set against pokewallet's
 * gallery sub-set. Matches by numeric suffix after stripping the prefix.
 */
async function syncGallerySubset(
  parentCardSetId: string,
  gallery: GallerySubset,
): Promise<{ matched: number; unmatched: number }> {
  const pwCards = await fetchAllPagesForSet(gallery.pokewalletSetId);
  if (pwCards.length === 0) return { matched: 0, unmatched: 0 };

  const prefix = gallery.prefix;
  const dbCards = await withRetry(() =>
    prisma.card.findMany({
      where: {
        cardSetId: parentCardSetId,
        OR: [
          { localId: { startsWith: prefix } },
          { localId: { startsWith: prefix.toLowerCase() } },
        ],
      },
      select: {
        id: true, localId: true, name: true, pokewalletId: true, rarity: true,
        priceOverrideAvg: true, priceOverrideReverseAvg: true,
      },
    }),
  );

  // Pokewallet gallery cards have card_numbers like "TG01/TG30" or "GG15/GG70".
  // Strip any leading letters + "/..." suffix + leading zeros to match our
  // DB's localId numeric part.
  const stripPrefix = (s: string | null | undefined): string =>
    (s ?? "").replace(/^[A-Z]+/i, "").split("/")[0].replace(/^0+/, "") || "0";

  const pwByNum = new Map<string, PokewalletCard[]>();
  for (const pw of pwCards) {
    if (isSealedProduct(pw.card_info.name, pw.card_info.card_number)) continue;
    if (isVariantPattern(pw.card_info.name)) continue;
    const num = stripPrefix(pw.card_info.card_number);
    if (!pwByNum.has(num)) pwByNum.set(num, []);
    pwByNum.get(num)!.push(pw);
  }

  const claimedPwIds = new Set<string>();
  const existing = await withRetry(() =>
    prisma.card.findMany({
      where: { pokewalletId: { not: null } },
      select: { pokewalletId: true },
    }),
  );
  for (const m of existing) if (m.pokewalletId) claimedPwIds.add(m.pokewalletId);

  type Pending = {
    dbCardId: string; pwId: string; claimed: boolean;
    pricing: ReturnType<typeof mapPokewalletPricing>;
    rarity: string | null;
    priceOverrideAvg: number | null;
    priceOverrideReverseAvg: number | null;
  };
  const pending: Pending[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const dbCard of dbCards) {
    const num = stripPrefix(dbCard.localId);
    const candidates = pwByNum.get(num) ?? [];
    if (candidates.length === 0) { unmatched++; continue; }
    let pw = candidates.find(
      (c) => c.card_info.name === dbCard.name && (c.cardmarket?.prices?.length ?? 0) > 0,
    );
    if (!pw) pw = candidates.find((c) => (c.cardmarket?.prices?.length ?? 0) > 0);
    pw ??= candidates[0];
    matched++;
    const pwIdAlreadyClaimed = claimedPwIds.has(pw.id);
    if (!pwIdAlreadyClaimed) claimedPwIds.add(pw.id);
    pending.push({
      dbCardId: dbCard.id,
      pwId: pw.id,
      claimed: pwIdAlreadyClaimed,
      pricing: mapPokewalletPricing(pw),
      rarity: dbCard.rarity,
      priceOverrideAvg: dbCard.priceOverrideAvg,
      priceOverrideReverseAvg: dbCard.priceOverrideReverseAvg,
    });
  }

  const today = todayUtc();
  const BATCH = 25;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await withRetry(() =>
      prisma.$transaction([
        ...batch.map((u) => {
          const data = u.claimed
            ? u.pricing
            : { pokewalletId: u.pwId, ...u.pricing };
          return prisma.card.update({ where: { id: u.dbCardId }, data });
        }),
        ...batch.map((u) => {
          const snapNormal = getMarktprijs({
            ...u.pricing, rarity: u.rarity, priceOverrideAvg: u.priceOverrideAvg,
          });
          const snapReverse = getMarktprijsReverseHolo({
            ...u.pricing, priceOverrideReverseAvg: u.priceOverrideReverseAvg,
          });
          return prisma.cardPriceHistory.upsert({
            where: { cardId_date: { cardId: u.dbCardId, date: today } },
            create: { cardId: u.dbCardId, date: today, priceNormal: snapNormal, priceReverse: snapReverse },
            update: { priceNormal: snapNormal, priceReverse: snapReverse },
          });
        }),
      ]),
    );
  }

  return { matched, unmatched };
}

/**
 * Refresh a single card by its PokeWallet ID.
 * Used for on-demand refresh when a user views a stale card.
 */
export async function syncSingleCard(cardId: string): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, pokewalletId: true, rarity: true },
  });
  if (!card?.pokewalletId) return false;

  const pw = await getCard(card.pokewalletId);
  const pricing = mapPokewalletPricing(pw);

  await prisma.card.update({
    where: { id: cardId },
    data: pricing,
  });

  const today = todayUtc();
  const snapNormal = getMarktprijs({ ...pricing, rarity: card.rarity });
  const snapReverse = getMarktprijsReverseHolo(pricing);
  await prisma.cardPriceHistory.upsert({
    where: { cardId_date: { cardId, date: today } },
    create: {
      cardId,
      date: today,
      priceNormal: snapNormal,
      priceReverse: snapReverse,
    },
    update: {
      priceNormal: snapNormal,
      priceReverse: snapReverse,
    },
  });

  return true;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
