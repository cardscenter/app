import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardImageUrl } from "@/lib/tcgdex/card-image";
import { normalizeForSearch } from "@/lib/search-utils";

// Public search over the local Card table for the /kaarten database page.
// Uses the searchName column for accent/diacritics-insensitive matching:
// "poke pad" finds "Poké Pad", "hakamoo" finds "Hakamo-o", etc.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10) || 500, 1000);

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.map((t) => normalizeForSearch(t));

  const where = {
    // Hide TCG Pocket cards — the overview page already excludes them.
    cardSet: { series: { tcgdexSeriesId: { notIn: ["tcgp"] } } },
    AND: normalizedTokens.map((nt, i) => {
      const original = tokens[i];
      const isNumeric = /^\d+$/.test(original);
      const ors: Array<Record<string, unknown>> = [
        // Primary: normalized name search (accent-insensitive)
        { searchName: { contains: nt } },
        // Also match against original name for backward compat
        { name: { contains: original } },
        // Set name (not normalized — set names rarely have accents)
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
      return { OR: ors };
    }),
  };

  const cards = await prisma.card.findMany({
    where,
    include: {
      cardSet: { select: { name: true, tcgdexSetId: true, releaseDate: true } },
    },
    take: Math.max(limit * 3, 120),
  });

  // Score by relevance using normalized comparison
  const normalizedQuery = normalizeForSearch(q);
  const scored = cards.map((c) => {
    const sn = c.searchName ?? normalizeForSearch(c.name);
    let score = 0;
    if (sn === normalizedQuery) score = 100;
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
    results: trimmed.map(({ card }) => ({
      id: card.id,
      name: card.name,
      localId: card.localId,
      rarity: card.rarity,
      setName: card.cardSet.name,
      setSlug: card.cardSet.tcgdexSetId,
      releaseDate: card.cardSet.releaseDate,
      imageUrl: getCardImageUrl(card, "low"),
      priceAvg: card.priceAvg,
      priceAvg7: card.priceAvg7,
      priceAvg30: card.priceAvg30,
      priceLow: card.priceLow,
      priceReverseAvg: card.priceReverseAvg,
      priceReverseAvg7: card.priceReverseAvg7,
      priceReverseAvg30: card.priceReverseAvg30,
      priceReverseLow: card.priceReverseLow,
    })),
  });
}
