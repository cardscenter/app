/**
 * Read-only check welke Community Hub-migraties op een (Turso-)database staan.
 *   npx tsx scripts/check-hub-migrations.ts "libsql://<db>.turso.io"
 * Leest TURSO_AUTH_TOKEN uit .env. Doet alleen SELECT's op sqlite_master/pragma.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const CHECKS: { file: string; tables?: string[]; columns?: [string, string][] }[] = [
  { file: "turso-hub-fase2.sql", tables: ["GuardianConsentToken", "MagicLinkToken", "GameOption"], columns: [["User", "role"], ["User", "dateOfBirth"], ["User", "deletedAt"]] },
  { file: "turso-hub-fase3.sql", tables: ["EventType", "ShopEvent", "EventRegistration", "Payment"] },
  { file: "turso-hub-fase4.sql", tables: ["MenuCategory", "MenuItem", "DiscountCode", "FoodOrder"] },
  { file: "turso-hub-fase5.sql", tables: ["LeagueSeason", "LeagueResult", "LeagueBadge", "UserLeagueBadge", "LoyaltyEntry", "NewsPost"], columns: [["User", "internalNote"]] },
  { file: "turso-hub-fase6.sql", tables: ["BulkPriceCategory"], columns: [["BuybackRequest", "userDecision"], ["BuybackRequest", "returnPaymentId"]] },
  { file: "turso-design-testimonials.sql", tables: ["ShopTestimonial"] },
];

async function main() {
  const url = process.argv[2];
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("Geef de database-URL mee");
  const client = createClient(url.startsWith("file:") ? { url } : { url, authToken });
  const tables = new Set((await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((r) => String(r.name)));
  const colCache = new Map<string, Set<string>>();
  const cols = async (t: string) => {
    if (!colCache.has(t)) colCache.set(t, new Set((await client.execute(`PRAGMA table_info("${t}")`)).rows.map((r) => String(r.name))));
    return colCache.get(t)!;
  };
  for (const c of CHECKS) {
    const missingT = (c.tables ?? []).filter((t) => !tables.has(t));
    const missingC: string[] = [];
    for (const [t, col] of c.columns ?? []) if (!(await cols(t)).has(col)) missingC.push(`${t}.${col}`);
    const ok = missingT.length === 0 && missingC.length === 0;
    const none = missingT.length === (c.tables ?? []).length && missingC.length === (c.columns ?? []).length;
    console.log(`${ok ? "OK      " : none ? "ONTBREEKT" : "DEELS   "} ${c.file}${ok ? "" : `  (mist: ${[...missingT, ...missingC].join(", ")})`}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
