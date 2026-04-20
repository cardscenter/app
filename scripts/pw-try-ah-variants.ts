import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return { status: r.status, body: await r.json() };
}
(async () => {
  // Probeer verschillende query-parameters
  const tests = [
    "/sets/24541?limit=500",
    "/sets/24541?include_variants=true",
    "/sets/24541?variants=all",
    "/sets/24541?show_variants=1",
    "/sets/24541?variant=all",
    "/sets/24541?type=all",
    "/sets/ASC?limit=500",
    "/search?q=ASC%20Ball%20Pattern",
    "/search?q=ASC%20Energy%20Pattern",
    "/search?q=ASC%20Ball%20Reverse",
    "/search?q=Ball%20Reverse%20Holo&limit=50",
    "/search?q=Ascended%20Heroes%20Ball",
    "/cards/?set_id=24541&variant=ball",  // probeer een hypothetische
  ];
  for (const path of tests) {
    try {
      const r = await api(path);
      let count: number | string = "?";
      if (r.body.cards) count = r.body.cards.length;
      else if (r.body.results) count = r.body.results.length;
      else if (r.body.total !== undefined) count = r.body.total;
      console.log(`[${r.status}] ${path}  count=${count}`);
      // Als er resultaten zijn met "Ball" in de naam, toon
      const items = (r.body.cards || r.body.results || []).filter((c: { card_info?: { name: string } }) => c.card_info?.name && /Ball|Energy.*Reverse/i.test(c.card_info.name));
      for (const i of items.slice(0, 3)) console.log(`     "${i.card_info?.name}" set="${i.card_info?.set_name}"`);
    } catch (e) {
      console.log(`[ERR] ${path}: ${String(e).slice(0, 60)}`);
    }
  }
})();
