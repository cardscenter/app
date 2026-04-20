import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardImageUrl } from "@/lib/card-image";

// Detail fetch for the typeahead card-picker (auction/listing/claimsale forms).
// Called after a user selects a search result — returns the high-res image
// and a CardMarket pricing snapshot so the form can show "Marktwaarde" hints.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  if (!cardId) {
    return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      cardSet: { select: { name: true, tcgdexSetId: true } },
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Kaart niet gevonden" }, { status: 404 });
  }

  const variantKeys: string[] = card.variants
    ? Object.entries(JSON.parse(card.variants) as Record<string, boolean>)
        .filter(([, v]) => v)
        .map(([k]) => k)
    : [];

  return NextResponse.json({
    id: card.id,
    localId: card.localId,
    name: card.name,
    rarity: card.rarity,
    variants: variantKeys,
    set: {
      id: card.cardSet.tcgdexSetId,
      name: card.cardSet.name,
    },
    imageUrl: getCardImageUrl(card, "high"),
    thumbnailUrl: getCardImageUrl(card, "low"),
    pricing:
      card.priceAvg !== null
        ? {
            avg: card.priceAvg,
            low: card.priceLow,
            trend: card.priceTrend,
            avg7: card.priceAvg7,
            avg30: card.priceAvg30,
            updated: card.priceUpdatedAt ? card.priceUpdatedAt.toISOString() : null,
          }
        : null,
  });
}
