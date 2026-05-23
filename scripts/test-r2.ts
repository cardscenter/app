// Snelle round-trip-test voor de R2-configuratie. Leest de R2_*-waarden uit
// .env, uploadt een tijdelijk testbestandje, leest het terug, en verwijdert het
// weer. Laat niets achter in de bucket. Draai met: npx tsx scripts/test-r2.ts
import "dotenv/config";
import { isR2Configured, r2PutObject, r2GetObject, r2DeleteObject } from "../src/lib/r2";

async function main() {
  if (!isR2Configured()) {
    console.error(
      "\n❌ R2 is niet geconfigureerd. Controleer of deze 4 regels in .env staan en gevuld zijn:\n" +
        "   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET\n",
    );
    process.exit(1);
  }

  const key = `__test/${Date.now()}-roundtrip.txt`;
  const payload = Buffer.from(`cards-center R2-test ${new Date().toISOString()}`);

  console.log(`→ Upload testbestand: ${key}`);
  await r2PutObject(key, payload, "text/plain");

  console.log("→ Teruglezen...");
  const got = await r2GetObject(key);
  if (!got || got.body.toString() !== payload.toString()) {
    console.error("❌ Teruglezen mislukt of inhoud klopt niet.");
    process.exit(1);
  }
  console.log(`✓ Inhoud klopt: "${got.body.toString()}"`);

  console.log("→ Verwijderen...");
  await r2DeleteObject(key);
  const after = await r2GetObject(key);
  console.log(after ? "⚠️  Object bestaat nog na delete" : "✓ Verwijderd");

  console.log("\n✅ R2 werkt volledig — upload, ophalen én verwijderen zijn gelukt.\n");
}

main().catch((err) => {
  console.error("\n❌ R2-test faalde. Meestal: verkeerde sleutel, bucket-naam of account-ID.\n", err);
  process.exit(1);
});
