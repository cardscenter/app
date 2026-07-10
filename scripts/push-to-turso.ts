// Past een SQL-bestand toe op de remote Turso-database, omdat `prisma db push`
// niet rechtstreeks met remote libSQL praat. Zonder tweede argument het volledige
// schema (prisma/turso-schema.sql — alleen voor een LEGE database!); voor
// incrementele migraties op de gevulde live-DB een additief bestand meegeven.
//
// Gebruik:  npx tsx scripts/push-to-turso.ts "libsql://<jouw-db>.turso.io" [pad/naar/migratie.sql]
//   - de database-URL komt als argument (niet geheim)
//   - het auth-token komt uit .env (TURSO_AUTH_TOKEN) — niet in de chat/argumenten
import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

async function main() {
  const url = process.argv[2] ?? process.env.TURSO_DATABASE_URL;
  const sqlFile = process.argv[3] ?? "prisma/turso-schema.sql";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("❌ Geef de Turso database-URL als argument mee.");
    process.exit(1);
  }
  if (!authToken) {
    console.error("❌ Zet TURSO_AUTH_TOKEN in je .env-bestand.");
    process.exit(1);
  }

  const sql = readFileSync(sqlFile, "utf8");
  const client = createClient({ url, authToken });

  console.log(`→ ${sqlFile} toepassen op Turso: ${url}`);
  await client.executeMultiple(sql);

  const res = await client.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const n = res.rows[0]?.n;
  console.log(`\n✅ Klaar — Turso heeft nu ${n} tabellen.`);
}

main().catch((err) => {
  console.error("\n❌ Schema-push faalde:", err);
  process.exit(1);
});
