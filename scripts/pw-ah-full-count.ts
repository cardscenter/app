import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return { status: r.status, body: await r.json() };
}
(async () => {
  // Probeer diverse parameters die 470 kunnen terughalen
  const params = [
    "",
    "?include_variants=1",
    "?all=1",
    "?expand=variants",
    "?variants=true",
    "?include_sealed=1",
    "?include_patterns=1",
    "?type=all",
    "?full=true",
  ];
  for (const p of params) {
    const r = await api(`/sets/24541${p}?limit=500`.replace(/\?\?/, "?"));
    const cnt = r.body.cards?.length ?? 0;
    const total = r.body.pagination?.total_cards ?? r.body.set?.total_cards ?? "?";
    console.log(`[${r.status}] /sets/24541${p}  got=${cnt}  total_cards=${total}`);
  }

  // Check pokewallet's /sets listing info
  const list = await api(`/sets`);
  const ah = list.body.data?.find((s: { set_id: string }) => s.set_id === "24541");
  console.log(`\nFrom /sets listing:`, JSON.stringify(ah));

  // Ook: endpoint /sets/{setcode}/cards (RESTful variant)
  for (const p of ["/cards", "/variants", "/all", "/products"]) {
    const r = await api(`/sets/24541${p}?limit=10`);
    console.log(`[${r.status}] /sets/24541${p}  body-keys=${Object.keys(r.body).join(",")}`);
  }
})();
