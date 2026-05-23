import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.argv[2] ?? process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  console.log("URL:", url);
  console.log("Token aanwezig:", !!authToken, "| lengte:", (authToken ?? "").length);
  if (!url || !authToken) { console.error("URL of token ontbreekt"); process.exit(1); }
  const client = createClient({ url, authToken });
  const r = await client.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  console.log("✅ Verbonden — aantal tabellen in Turso:", r.rows[0]?.n);
  const u = await client.execute("SELECT count(*) AS n FROM User");
  console.log("User-tabel telt:", u.rows[0]?.n, "rijen");
}
main().catch((e) => { console.error("❌ Connectie mislukt:", e.message ?? e); process.exit(1); });
