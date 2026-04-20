import { NextResponse } from "next/server";
import { syncSingleCard } from "@/lib/pokewallet/sync";

// GET /api/pokewallet/card/:cardId
//
// On-demand single-card refresh — called when a user views a card whose
// pricing is stale. Costs 1 API call. Returns 200 OK on success, 404 if
// the card has no pokewalletId mapping (sync first).

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  try {
    const ok = await syncSingleCard(cardId);
    if (!ok) {
      return NextResponse.json(
        { error: "Card has no pokewalletId mapping" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, cardId });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message.slice(0, 200) },
      { status: 500 },
    );
  }
}
