/**
 * Vergelijkt het verwachte schema (prisma/schema.prisma) met een (Turso-)database:
 * welke tabellen en kolommen ontbreken er, en welke staan er extra. Read-only.
 *   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > <tmp>/expected.sql
 *   npx tsx scripts/compare-schema.ts <tmp>/expected.sql "libsql://<db>.turso.io"
 */
import "dotenv/config";
import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

async function shape(client: Client): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  for (const r of tables.rows) {
    const t = String(r.name);
    const cols = await client.execute(`PRAGMA table_info("${t}")`);
    out.set(t, new Set(cols.rows.map((c) => String(c.name))));
  }
  return out;
}

async function main() {
  const [sqlFile, url] = process.argv.slice(2);
  if (!sqlFile || !url) throw new Error("Gebruik: compare-schema.ts <expected.sql> <db-url>");
  const tmp = path.join(os.tmpdir(), `cc-expected-${Date.now()}.db`);
  const expectedDb = createClient({ url: `file:${tmp}` });
  await expectedDb.executeMultiple(readFileSync(sqlFile, "utf8"));
  const expected = await shape(expectedDb);
  expectedDb.close();

  const target = createClient(url.startsWith("file:") ? { url } : { url, authToken: process.env.TURSO_AUTH_TOKEN });
  const actual = await shape(target);

  let problems = 0;
  for (const [t, cols] of expected) {
    const have = actual.get(t);
    if (!have) {
      console.log(`MIST TABEL   ${t}`);
      problems++;
      continue;
    }
    const missing = [...cols].filter((c) => !have.has(c));
    if (missing.length) {
      console.log(`MIST KOLOM   ${t}: ${missing.join(", ")}`);
      problems++;
    }
  }
  for (const t of actual.keys()) if (!expected.has(t)) console.log(`EXTRA TABEL  ${t} (staat niet meer in het schema)`);
  console.log(problems === 0 ? "Schema compleet." : `${problems} verschil(len).`);
  target.close();
  // Windows geeft het bestand soms niet direct vrij; opruimen mag mislukken.
  try {
    rmSync(tmp, { force: true });
  } catch {}
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
