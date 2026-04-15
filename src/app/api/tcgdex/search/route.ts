import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCardImageUrl } from "@/lib/tcgdex/card-image";

// Search against our local Card table. This is strictly better than hitting
// TCGdex every keystroke: we already imported all 23k+ cards with their set
// metadata, which lets us:
//   - return results sorted by set release-date (newest first)
//   - match tokens across BOTH card-name and set-name ("weedle vivid voltage")
//   - show set-name + variants inline in the suggestion list
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Split the query into tokens. Every token must match either the card name
  // or the set name — that gives us "weedle vivid voltage" → Weedle in Vivid
  // Voltage.
  const tokens = q.split(/\s+/).filter((t) => t.length > 0);

  const cards = await prisma.card.findMany({
    where: {
      AND: tokens.map((t) => ({
        OR: [
          { name: { contains: t } },
          { cardSet: { name: { contains: t } } },
        ],
      })),
    },
    include: {
      cardSet: {
        select: { name: true, tcgdexSetId: true, releaseDate: true },
      },
    },
    // Fetch a wider candidate pool so we can rank locally — cheaper than
    // trying to express relevance in Prisma.
    take: Math.max(limit * 4, 80),
  });

  // Relevance scoring:
  //   - card-name exact match (case-insensitive) > starts-with > contains
  //   - then tie-break by set release-date desc (newest first)
  const lower = q.toLowerCase();
  const scored = cards.map((c) => {
    const name = c.name.toLowerCase();
    let score = 0;
    if (name === lower) score = 100;
    else if (name.startsWith(lower)) score = 80;
    else if (name.includes(lower)) score = 50;
    else score = 10; // matched via set-name only
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
    results: trimmed.map(({ card }) => {
      const variants: Record<string, boolean> = card.variants
        ? JSON.parse(card.variants)
        : {};
      const variantKeys = Object.entries(variants)
        .filter(([, v]) => v)
        .map(([k]) => k);
      return {
        id: card.id,
        name: card.name,
        localId: card.localId,
        thumbnailUrl: getCardImageUrl(card, "low"),
        setName: card.cardSet.name,
        setId: card.cardSet.tcgdexSetId,
        releaseDate: card.cardSet.releaseDate,
        rarity: card.rarity,
        variants: variantKeys,
      };
    }),
  });
}
