import { NextResponse } from "next/server";
import { buildCardImageUrl, getCard } from "@/lib/tcgdex/client";
import { auth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tcgdexId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { tcgdexId } = await params;
  if (!tcgdexId) {
    return NextResponse.json({ error: "Missing tcgdexId" }, { status: 400 });
  }

  try {
    const card = await getCard(tcgdexId);
    if (!card) {
      return NextResponse.json({ error: "Kaart niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({
      id: card.id,
      localId: card.localId,
      name: card.name,
      rarity: card.rarity ?? null,
      hp: card.hp ?? null,
      types: card.types ?? null,
      illustrator: card.illustrator ?? null,
      variants: card.variants ?? null,
      set: card.set,
      imageUrl: buildCardImageUrl(card.image, "high", "webp"),
      thumbnailUrl: buildCardImageUrl(card.image, "low", "webp"),
      pricing: card.pricing?.cardmarket
        ? {
            avg: card.pricing.cardmarket.avg,
            low: card.pricing.cardmarket.low,
            trend: card.pricing.cardmarket.trend,
            avg7: card.pricing.cardmarket.avg7,
            avg30: card.pricing.cardmarket.avg30,
            updated: card.pricing.cardmarket.updated,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TCGdex error" },
      { status: 502 }
    );
  }
}
