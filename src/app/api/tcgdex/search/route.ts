import { NextResponse } from "next/server";
import { buildCardImageUrl, searchCards } from "@/lib/tcgdex/client";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  // Cheap protection against abuse — only logged-in users can search.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);

  try {
    const results = await searchCards(q, { limit });
    return NextResponse.json({
      results: results.map((c) => ({
        id: c.id,
        name: c.name,
        localId: c.localId,
        thumbnailUrl: buildCardImageUrl(c.image, "low", "webp"),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TCGdex error" },
      { status: 502 }
    );
  }
}
