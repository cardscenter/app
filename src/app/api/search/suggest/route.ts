import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/global-search";

// Live-suggesties voor de header-zoekbalk: één round-trip die de beste
// treffers per categorie teruggeeft (4 kaarten / 3 pokémon / 3 aanbod /
// 3 gebruikers). Publiek endpoint; ingelogde gebruikers krijgen dezelfde
// block-/landfilters als de overzichtspagina's (via auth() in de query-laag).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const suggestions = await getSearchSuggestions(q);

  return NextResponse.json(suggestions, {
    // Per-gebruiker gefilterd (blokkades/land) → nooit cachen.
    headers: { "Cache-Control": "no-store" },
  });
}
