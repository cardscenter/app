import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardImageUrl } from "@/lib/card-image";
import { normalizeForSearch } from "@/lib/search-utils";

// Public search over the local Card table for the /kaarten database page.
// Uses the searchName column for accent/diacritics-insensitive matching:
// "poke pad" finds "Poké Pad", "hakamoo" finds "Hakamo-o", etc.
//
// Advanced filters (all optional): priceMin/priceMax, hpMin/hpMax,
// yearMin/yearMax, seriesId, setId, illustrator,
// category (Pokemon|Trainer|Energy), and comma-separated: types, rarities,
// regulationMarks. When any advanced filter is set, the q>=2 requirement
// is relaxed.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10) || 500, 1000);

  const csv = (key: string) =>
    (searchParams.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const num = (key: string) => {
    const raw = searchParams.get(key);
    if (raw === null || raw === "") return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const priceMin = num("priceMin");
  const priceMax = num("priceMax");
  const hpMin = num("hpMin");
  const hpMax = num("hpMax");
  const yearMin = num("yearMin");
  const yearMax = num("yearMax");
  const types = csv("types");
  const rarities = csv("rarities");
  const regulationMarks = csv("regulationMarks");
  const seriesId = (searchParams.get("seriesId") ?? "").trim();
  const setId = (searchParams.get("setId") ?? "").trim();
  const illustrator = (searchParams.get("illustrator") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();

  const hasAdvancedFilters =
    !Number.isNaN(priceMin) ||
    !Number.isNaN(priceMax) ||
    !Number.isNaN(hpMin) ||
    !Number.isNaN(hpMax) ||
    !Number.isNaN(yearMin) ||
    !Number.isNaN(yearMax) ||
    types.length > 0 ||
    rarities.length > 0 ||
    regulationMarks.length > 0 ||
    seriesId.length > 0 ||
    setId.length > 0 ||
    illustrator.length > 0 ||
    category.length > 0;

  if (q.length < 2 && !hasAdvancedFilters) {
    return NextResponse.json({ results: [], totalCount: 0 });
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.map((t) => normalizeForSearch(t));

  const andClauses: Array<Record<string, unknown>> = [];

  if (q.length >= 2) {
    for (let i = 0; i < normalizedTokens.length; i++) {
      const nt = normalizedTokens[i];
      const original = tokens[i];
      const isNumeric = /^\d+$/.test(original);
      const ors: Array<Record<string, unknown>> = [
        { searchName: { contains: nt } },
        { name: { contains: original } },
        { cardSet: { name: { contains: original } } },
      ];
      if (isNumeric) {
        const n = parseInt(original, 10);
        const variants = Array.from(
          new Set([
            String(n),
            String(n).padStart(2, "0"),
            String(n).padStart(3, "0"),
            String(n).padStart(4, "0"),
          ])
        );
        ors.push({ localId: { in: variants } });
      } else {
        ors.push({ localId: { contains: original } });
      }
      andClauses.push({ OR: ors });
    }
  }

  // Price range (priceAvg)
  if (!Number.isNaN(priceMin)) andClauses.push({ priceAvg: { gte: priceMin } });
  if (!Number.isNaN(priceMax)) andClauses.push({ priceAvg: { lte: priceMax } });

  // HP range
  if (!Number.isNaN(hpMin)) andClauses.push({ hp: { gte: hpMin } });
  if (!Number.isNaN(hpMax)) andClauses.push({ hp: { lte: hpMax } });

  // Year range — releaseDate is ISO string, so string compare works
  if (!Number.isNaN(yearMin))
    andClauses.push({ cardSet: { releaseDate: { gte: `${Math.trunc(yearMin)}-01-01` } } });
  if (!Number.isNaN(yearMax))
    andClauses.push({ cardSet: { releaseDate: { lte: `${Math.trunc(yearMax)}-12-31` } } });

  // Types: JSON array like ["Fire","Water"] — match any
  if (types.length > 0) {
    andClauses.push({
      OR: types.map((t) => ({ types: { contains: `"${t}"` } })),
    });
  }

  // Rarities: exact match
  if (rarities.length > 0) andClauses.push({ rarity: { in: rarities } });

  // Series
  if (seriesId) andClauses.push({ cardSet: { seriesId } });

  // Set
  if (setId) andClauses.push({ cardSetId: setId });

  // Illustrator
  if (illustrator) andClauses.push({ illustrator: { contains: illustrator } });

  // gameplayJson field matches — tolerant of optional space after colon
  const jsonContains = (field: string, value: string) => ({
    OR: [
      { gameplayJson: { contains: `"${field}":"${value}"` } },
      { gameplayJson: { contains: `"${field}": "${value}"` } },
    ],
  });

  if (regulationMarks.length > 0) {
    andClauses.push({
      OR: regulationMarks.flatMap((m) => jsonContains("regulationMark", m).OR),
    });
  }
  if (category) {
    andClauses.push(jsonContains("category", category));
  }

  // `buybackOnly=true` narrows the result set to cards actually accepted by
  // the Collection Buyback Calculator: excludes bulk-only rarities (common/
  // uncommon/rare/rare holo — those go through the Bulk Calculator) and
  // promo-only McDonald's sets (not in scope for buyback).
  const buybackOnly = searchParams.get("buybackOnly") === "true";

  const where: Record<string, unknown> = {
    cardSet: { series: { tcgdexSeriesId: { notIn: ["tcgp"] } } },
  };
  if (andClauses.length > 0) where.AND = andClauses;

  if (buybackOnly) {
    const buybackClauses: Array<Record<string, unknown>> = [
      { NOT: { rarity: { in: ["Common", "Uncommon", "Rare", "Rare Holo", "Holo Rare"] } } },
      { cardSet: { NOT: { name: { startsWith: "McDonald" } } } },
    ];
    where.AND = Array.isArray(where.AND)
      ? [...(where.AND as Array<Record<string, unknown>>), ...buybackClauses]
      : buybackClauses;
  }

  // Soft cap: when the full result set is too wide we skip the fetch and
  // let the UI ask the user to narrow their query. Keeps payloads small
  // and avoids scoring work we'd throw away.
  const MAX_RESULTS = 300;
  const totalCount = await prisma.card.count({ where });
  if (totalCount > MAX_RESULTS) {
    return NextResponse.json({ results: [], totalCount });
  }

  const cards = await prisma.card.findMany({
    where,
    include: {
      cardSet: { select: { name: true, tcgdexSetId: true, releaseDate: true } },
    },
    take: Math.max(limit * 3, 120),
  });

  const normalizedQuery = normalizeForSearch(q);
  const scored = cards.map((c) => {
    const sn = c.searchName ?? normalizeForSearch(c.name);
    let score = 0;
    if (q.length === 0) score = 50;
    else if (sn === normalizedQuery) score = 100;
    else if (sn.startsWith(normalizedQuery)) score = 80;
    else if (sn.includes(normalizedQuery)) score = 50;
    else score = 10;
    return { card: c, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.card.cardSet.releaseDate ?? "0000-00-00";
    const db = b.card.cardSet.releaseDate ?? "0000-00-00";
    return db.localeCompare(da);
  });

  const trimmed = scored.slice(0, limit);

  return NextResponse.json({
    totalCount,
    results: trimmed.map(({ card }) => ({
      id: card.id,
      name: card.name,
      localId: card.localId,
      rarity: card.rarity,
      setName: card.cardSet.name,
      setSlug: card.cardSet.tcgdexSetId,
      releaseDate: card.cardSet.releaseDate,
      imageUrl: getCardImageUrl(card, "low"),
      // CardMarket normal — voor Marktprijs-formule
      priceAvg: card.priceAvg,
      priceLow: card.priceLow,
      priceTrend: card.priceTrend,
      priceAvg7: card.priceAvg7,
      priceAvg30: card.priceAvg30,
      // CardMarket reverse holo
      priceReverseAvg: card.priceReverseAvg,
      priceReverseLow: card.priceReverseLow,
      priceReverseTrend: card.priceReverseTrend,
      priceReverseAvg7: card.priceReverseAvg7,
      priceReverseAvg30: card.priceReverseAvg30,
      // TCGPlayer — TP-cross-check + RH-fallback
      priceTcgplayerNormalMarket: card.priceTcgplayerNormalMarket,
      priceTcgplayerHolofoilMarket: card.priceTcgplayerHolofoilMarket,
      priceTcgplayerReverseMarket: card.priceTcgplayerReverseMarket,
      priceTcgplayerReverseMid: card.priceTcgplayerReverseMid,
      // Manual overrides — always win in getMarktprijs
      priceOverrideAvg: card.priceOverrideAvg,
      priceOverrideReverseAvg: card.priceOverrideReverseAvg,
      // TCGdex variants-JSON — used to gate reverse-holo eligibility
      variants: card.variants,
    })),
  });
}
