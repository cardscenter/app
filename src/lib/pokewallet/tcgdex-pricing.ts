// TCGdex CardMarket-prijs FALLBACK voor kaarten die PokeWallet niet kan prijzen.
//
// PokeWallet is en blijft de PRIMAIRE bron. Maar een handvol kaarten (oude
// promo's, basis-energie, secret holos) heeft in PokeWallet geen bruikbare
// prijs — terwijl TCGdex voor die exacte kaart wél een CardMarket-prijs heeft.
//
// Veilig omdat we matchen op de EXACTE kaart-id: onze Card.id IS de TCGdex-id
// (bv. "dp7-SH1", "sm1-164"). Geen naam-zoektocht → geen risico op een
// gelijknamige kaart uit een andere set/variant. We schrijven alleen wanneer
// TCGdex daadwerkelijk een waarde heeft.
//
// Draait als laatste stap NA de PokeWallet-prijs-sync, zodat de PW-sync (die
// een lege prijs zou wegschrijven) deze waarden niet overschrijft.

import { prisma } from "@/lib/prisma";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
import { fetchTcgdexCard } from "@/lib/tcgdex/client";
import type { MappedPricing } from "./pricing";

/** TCGdex cardmarket-pricing blok (niet volledig in de client-types gemodelleerd). */
interface TcgdexCmPricing {
  avg?: number | null; low?: number | null; trend?: number | null;
  avg7?: number | null; avg30?: number | null;
  "avg-holo"?: number | null; "low-holo"?: number | null; "trend-holo"?: number | null;
  "avg7-holo"?: number | null; "avg30-holo"?: number | null;
  updated?: string;
}

/**
 * Map TCGdex' cardmarket-pricing → onze DB-prijsvelden. TCGdex' "-holo"-suffix
 * is — net als PokeWallet's variant_type "holo" — de REVERSE-HOLO. Geeft null
 * terug als er geen enkele bruikbare normale waarde is.
 */
export function mapTcgdexCmPricing(cm: TcgdexCmPricing | null | undefined): MappedPricing | null {
  if (!cm) return null;
  const hasNormal = cm.avg != null || cm.trend != null || cm.low != null || cm.avg7 != null;
  if (!hasNormal) return null;
  return {
    priceAvg: cm.avg ?? null,
    priceLow: cm.low ?? null,
    priceTrend: cm.trend ?? null,
    priceAvg7: cm.avg7 ?? null,
    priceAvg30: cm.avg30 ?? null,
    priceReverseAvg: cm["avg-holo"] ?? null,
    priceReverseLow: cm["low-holo"] ?? null,
    priceReverseTrend: cm["trend-holo"] ?? null,
    priceReverseAvg7: cm["avg7-holo"] ?? null,
    priceReverseAvg30: cm["avg30-holo"] ?? null,
    priceUpdatedAt: cm.updated ? new Date(cm.updated) : new Date(),
    // TCGdex levert hier geen TCGPlayer-velden die wij gebruiken — laat null.
    priceTcgplayerNormalLow: null, priceTcgplayerNormalMid: null, priceTcgplayerNormalMarket: null,
    priceTcgplayerHolofoilLow: null, priceTcgplayerHolofoilMid: null, priceTcgplayerHolofoilMarket: null,
    priceTcgplayerReverseLow: null, priceTcgplayerReverseMid: null, priceTcgplayerReverseMarket: null,
    priceTcgplayerUpdatedAt: null,
  };
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const BASIC_ENERGY_NAMES = new Set([
  "Grass Energy", "Fire Energy", "Water Energy", "Lightning Energy", "Psychic Energy",
  "Fighting Energy", "Darkness Energy", "Metal Energy", "Fairy Energy",
]);
const BASIC_ENERGY_MAX_EUR = 3;

/**
 * Anti-contaminatie guard voor de TCGdex-fallback. Een basis-energie hoort
 * een paar dubbeltjes te kosten; een CardMarket-idProduct-collision laat 'm
 * soms €8-12 tonen (consistent over alle tijdvensters, maar 100× de siblings
 * en zónder TCGPlayer-cross-check om te verifiëren). Vertrouw zo'n waarde niet.
 */
function isImplausibleTcgdexPrice(name: string, pricing: MappedPricing): boolean {
  return BASIC_ENERGY_NAMES.has(name) && (pricing.priceAvg ?? 0) > BASIC_ENERGY_MAX_EUR;
}

/**
 * Vind kaarten zonder enig prijssignaal en vul ze met TCGdex' CardMarket-prijs
 * waar die bestaat. Idempotent. Returnt {checked, priced}.
 *
 * Cap via `limit` (default 300) zodat een run begrensd blijft; de genuinely-
 * bronloze kaarten worden elke run opnieuw geprobeerd maar dat zijn er weinig.
 */
export async function backfillTcgdexPricing(opts: { limit?: number } = {}): Promise<{
  checked: number; priced: number; pricedCards: { id: string; name: string; avg: number | null }[];
}> {
  const limit = opts.limit ?? 300;
  const candidates = await prisma.card.findMany({
    where: {
      priceAvg: null, priceAvg7: null, priceTrend: null,
      priceTcgplayerNormalMarket: null, priceTcgplayerHolofoilMarket: null,
    },
    select: { id: true, name: true, rarity: true },
    take: limit,
  });

  let priced = 0;
  const pricedCards: { id: string; name: string; avg: number | null }[] = [];
  const today = todayUtc();

  // Beperkte concurrency tegen TCGdex (keyless, wees beleefd).
  const CONC = 5;
  for (let i = 0; i < candidates.length; i += CONC) {
    const batch = candidates.slice(i, i + CONC);
    const results = await Promise.all(
      batch.map(async (c) => {
        try {
          const tc = (await fetchTcgdexCard(c.id)) as unknown as { pricing?: { cardmarket?: TcgdexCmPricing } } | null;
          const pricing = mapTcgdexCmPricing(tc?.pricing?.cardmarket);
          if (!pricing) return null;
          if (isImplausibleTcgdexPrice(c.name, pricing)) return null; // contaminatie-guard
          return { c, pricing };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (!r) continue;
      const { c, pricing } = r;
      const snapN = getMarktprijs({ ...pricing, rarity: c.rarity } as never);
      const snapR = getMarktprijsReverseHolo(pricing as never);
      await prisma.card.update({ where: { id: c.id }, data: pricing });
      await prisma.cardPriceHistory.upsert({
        where: { cardId_date: { cardId: c.id, date: today } },
        create: { cardId: c.id, date: today, priceNormal: snapN, priceReverse: snapR },
        update: { priceNormal: snapN, priceReverse: snapR },
      });
      priced++;
      pricedCards.push({ id: c.id, name: c.name, avg: pricing.priceAvg });
    }
  }

  return { checked: candidates.length, priced, pricedCards };
}
