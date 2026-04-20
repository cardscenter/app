import "dotenv/config";

const KEY = process.env.POKEWALLET_API_KEY!;

(async () => {
  for (const page of [1, 2, 3, 4]) {
    const r = await fetch(
      `https://api.pokewallet.io/sets/24541?limit=200&page=${page}`,
      { headers: { "X-API-Key": KEY } },
    );
    const d = (await r.json()) as { cards?: Array<{ id: string; card_info: { name: string; card_number: string } }>; pagination?: { page: number; total_pages: number; total_cards?: number }; set?: { total_cards?: number } };
    console.log(
      `page ${page}: ${d.cards?.length ?? 0} cards, total_pages=${d.pagination?.total_pages}, total_cards=${d.pagination?.total_cards ?? d.set?.total_cards}`,
    );
    // Show samples op page 2+ om te zien welke namen er zijn
    if (page >= 2 && d.cards?.length) {
      for (const c of d.cards.slice(0, 5)) {
        console.log(`    "${c.card_info.name}" #${c.card_info.card_number}`);
      }
    }
  }
})();
