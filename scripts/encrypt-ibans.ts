// Eenmalige versleuteling van bestaande IBANs (Community Hub, Fase 6).
//
// Kolommen: User.iban, BuybackRequest.iban, WithdrawalRequest.iban. Rijen die
// al met "enc:v1:" beginnen worden overgeslagen; het script is dus idempotent.
//
// Standaard DRY-RUN. Vereist IBAN_ENCRYPTION_KEY in .env (de sleutel die ook
// op Railway staat, anders kan de app ze niet meer lezen).
//
// Gebruik:
//   lokaal:  npx tsx scripts/encrypt-ibans.ts
//   apply:   npx tsx scripts/encrypt-ibans.ts --apply
//   Turso:   npx tsx scripts/encrypt-ibans.ts "libsql://<db>.turso.io" --apply
//            (TURSO_AUTH_TOKEN uit .env)
import "dotenv/config";
import { createClient } from "@libsql/client";
import { encryptIban, isEncryptedIban } from "../src/lib/iban-crypto";

const TABLES = ["User", "BuybackRequest", "WithdrawalRequest"] as const;

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const urlArg = args.find((a) => !a.startsWith("--"));
  const url = urlArg ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Geen database-URL (argument of DATABASE_URL in .env).");
    process.exit(1);
  }
  const isRemote = url.startsWith("libsql://");
  if (isRemote && !process.env.IBAN_ENCRYPTION_KEY) {
    console.error("IBAN_ENCRYPTION_KEY ontbreekt in .env; voor een live database is een vaste sleutel verplicht.");
    process.exit(1);
  }
  const client = createClient({ url, authToken: isRemote ? process.env.TURSO_AUTH_TOKEN : undefined });
  console.log(`${apply ? "APPLY" : "DRY-RUN"} op ${isRemote ? url : "lokale DB"}`);

  for (const table of TABLES) {
    const rows = await client.execute(`SELECT id, iban FROM "${table}" WHERE iban IS NOT NULL AND iban != ''`);
    let todo = 0;
    for (const row of rows.rows) {
      const id = String(row.id);
      const iban = String(row.iban);
      if (isEncryptedIban(iban)) continue;
      todo++;
      if (apply) {
        await client.execute({ sql: `UPDATE "${table}" SET iban = ? WHERE id = ?`, args: [encryptIban(iban), id] });
      }
    }
    console.log(`${table}: ${rows.rows.length} rijen met IBAN, ${todo} ${apply ? "versleuteld" : "te versleutelen"}`);
  }
  if (!apply) console.log("Niets gewijzigd. Voeg --apply toe om te versleutelen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
