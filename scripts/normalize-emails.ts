// Eenmalige normalisatie van User.email naar lower(trim(email)) — Fase 45.
//
// Achtergrond: registratie sloeg het e-mailadres letterlijk op, terwijl de
// wachtwoord-reset-lookup lowercased. SQLite vergelijkt binair, dus een
// account met een hoofdletter in het adres kreeg nooit een reset-mail.
// Sinds Fase 45 normaliseren registratie/login zelf; dit script trekt de
// bestaande rijen gelijk.
//
// Standaard DRY-RUN. Controleert eerst op botsingen (twee accounts die na
// normalisatie hetzelfde adres krijgen) en breekt dan af — die los je
// handmatig op.
//
// Gebruik:
//   lokaal:  npx tsx scripts/normalize-emails.ts                (leest DATABASE_URL uit .env)
//   apply:   npx tsx scripts/normalize-emails.ts --apply
//   Turso:   npx tsx scripts/normalize-emails.ts "libsql://<db>.turso.io" --apply
//            (TURSO_AUTH_TOKEN uit .env)
import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const urlArg = args.find((a) => !a.startsWith("--"));
  const url = urlArg ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Geen database-URL (argument of DATABASE_URL in .env).");
    process.exit(1);
  }
  const isRemote = url.startsWith("libsql://");
  const authToken = isRemote ? process.env.TURSO_AUTH_TOKEN : undefined;
  if (isRemote && !authToken) {
    console.error("❌ Zet TURSO_AUTH_TOKEN in je .env-bestand.");
    process.exit(1);
  }

  const client = createClient({ url, authToken });
  console.log(`→ ${apply ? "APPLY" : "DRY-RUN"} op ${isRemote ? url : "lokale DB"}`);

  const collisions = await client.execute(
    `SELECT lower(trim(email)) AS e, COUNT(*) AS c FROM "User" GROUP BY e HAVING c > 1`,
  );
  if (collisions.rows.length > 0) {
    console.error("❌ Botsingen gevonden — eerst handmatig oplossen:");
    for (const row of collisions.rows) console.error(`   ${row.e} (${row.c}×)`);
    process.exit(2);
  }

  const affected = await client.execute(
    `SELECT id, email FROM "User" WHERE email != lower(trim(email))`,
  );
  console.log(`${affected.rows.length} adres(sen) wijken af van de genormaliseerde vorm.`);
  for (const row of affected.rows) console.log(`   ${row.id}: "${row.email}"`);

  if (!apply) {
    console.log("Dry-run klaar. Voeg --apply toe om te normaliseren.");
    return;
  }
  const res = await client.execute(
    `UPDATE "User" SET email = lower(trim(email)) WHERE email != lower(trim(email))`,
  );
  console.log(`✓ ${res.rowsAffected} rij(en) genormaliseerd.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
