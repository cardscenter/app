import "dotenv/config";
import { createClient } from "@libsql/client";

// Meet de round-trip-latency naar een Turso (libSQL) database. Elke Prisma-query
// in productie is zo'n HTTP-round-trip; dit script kwantificeert wat één query
// kost zodat we kunnen beslissen of een embedded replica / region-co-locatie
// de moeite waard is (Fase 3 van de performance-optimalisatie).
//
// ⚠️ BELANGRIJK — waar je dit draait bepaalt wat je meet:
//   - Lokaal (`npx tsx scripts/measure-turso-latency.ts "libsql://...turso.io"`):
//     meet JOUW-machine ↔ Turso. Alleen representatief als jouw machine in
//     dezelfde regio zit als de Railway-container.
//   - Voor het ECHTE getal (Railway-container ↔ Turso): draai dit op Railway,
//     bv. via een tijdelijke deploy/exec, of `railway run npx tsx scripts/...`
//     (let op: `railway run` draait lokaal mét Railway-env, dus nog steeds jouw
//     machine — voor 100% accuraat moet het ín de container draaien).
//
// Gebruik: npx tsx scripts/measure-turso-latency.ts "libsql://<db>.turso.io" [N]
// (URL valt terug op TURSO_DATABASE_URL / DATABASE_URL; N = aantal samples, default 25)

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((s, v) => s + v, 0);
  const fmt = (n: number) => `${n.toFixed(1)}ms`;
  console.log(
    `  ${label.padEnd(28)} ` +
      `min=${fmt(sorted[0])}  ` +
      `median=${fmt(pct(sorted, 50))}  ` +
      `avg=${fmt(sum / samples.length)}  ` +
      `p95=${fmt(pct(sorted, 95))}  ` +
      `max=${fmt(sorted[sorted.length - 1])}`,
  );
}

async function timeMany(
  fn: () => Promise<unknown>,
  n: number,
): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return samples;
}

async function main() {
  const url =
    process.argv[2] ??
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const n = Number(process.argv[3] ?? 25);

  console.log("Turso latency-meting");
  console.log("URL:", url);
  console.log("Token aanwezig:", !!authToken, "| samples per test:", n);
  if (!url) {
    console.error("Geen URL. Geef libsql://-URL als 1e argument of zet DATABASE_URL.");
    process.exit(1);
  }
  if (url.startsWith("file:")) {
    console.warn(
      "\n⚠️  Je meet een lokaal file:-SQLite-bestand (geen netwerk). Voor een " +
        "zinvolle meting geef je de productie libsql://-Turso-URL mee.\n",
    );
  }

  const client = createClient(
    authToken && !url.startsWith("file:") ? { url, authToken } : { url },
  );

  // Warm-up (eerste call zet de HTTP-connectie op — niet meetellen).
  await client.execute("SELECT 1");

  console.log("\nResultaten (lager = beter):");

  // 1. Pure round-trip: minimale query, meet vooral netwerk + protocol-overhead.
  const ping = await timeMany(() => client.execute("SELECT 1"), n);
  summarize("SELECT 1 (pure round-trip)", ping);

  // 2. Geïndexeerde puntlookup op een echte tabel (representatief voor app-reads).
  const lookup = await timeMany(
    () =>
      client.execute({
        sql: "SELECT id FROM Card WHERE cardSetId = ? AND localId = ? LIMIT 1",
        args: ["base1", "4"],
      }),
    n,
  );
  summarize("Card index-lookup", lookup);

  // 3. Count (iets zwaarder, scant meer).
  const count = await timeMany(
    () => client.execute("SELECT count(*) AS n FROM User"),
    n,
  );
  summarize("count(User)", count);

  const median = [...ping].sort((a, b) => a - b)[Math.floor(ping.length / 2)];
  console.log("\nInterpretatie:");
  if (url.startsWith("file:")) {
    console.log("  (lokaal bestand — niet representatief voor productie)");
  } else if (median <= 30) {
    console.log(
      `  ✅ Mediane round-trip ${median.toFixed(1)}ms — laag. Region-co-locatie is ` +
        "waarschijnlijk al goed; embedded replica levert weinig extra op.",
    );
  } else if (median <= 80) {
    console.log(
      `  ⚠️  Mediane round-trip ${median.toFixed(1)}ms — matig. Pagina's met veel ` +
        "queries stapelen dit op. Overweeg een Turso-replica in de Railway-regio.",
    );
  } else {
    console.log(
      `  🔴 Mediane round-trip ${median.toFixed(1)}ms — hoog (waarschijnlijk ` +
        "cross-region). Een replica in de Railway-regio of een embedded replica " +
        "(lokale reads) zou alle pagina's flink versnellen.",
    );
  }
  console.log(
    "\n  Onthoud: een typische pagina doet meerdere queries. Bij ~Xms/query en " +
      "M queries is de DB-bijdrage ~X·Mms. Daarom is queries-verminderen " +
      "(batching/caching) net zo belangrijk als de round-trip verlagen.",
  );
}

main().catch((e) => {
  console.error("❌ Meting mislukt:", (e as Error).message ?? e);
  process.exit(1);
});
