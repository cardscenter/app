import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(p: string) {
  const r = await fetch(`https://api.pokewallet.io${p}`, { headers: { "X-API-Key": KEY } });
  try { return await r.json(); } catch { return null; }
}
(async () => {
  const r = await api("/sets/24541/completion-value?detailed=1");
  console.log(JSON.stringify(r, null, 2).slice(0, 4000));
})();
