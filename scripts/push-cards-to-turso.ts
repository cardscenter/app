// Pusht de lokale kaart-data (Series + CardSet + Card) compact naar Turso.
//
// Compact = alleen identiteit + meta-velden. Prijzen, prijs-historie en
// cache-velden gaan NIET mee — die rebuild de daily `sync-pokewallet` cron
// na de eerste run. Doel: kleinste dump om Turso van leeg → bruikbaar te
// krijgen.
//
// Idempotent via SQLite UPSERT (`INSERT ... ON CONFLICT(id) DO UPDATE SET ...`).
// Re-runnen overschrijft alléén meta-velden, raakt prijs-columns niet aan —
// zo blijven cron-updates op Turso bewaard als je later een meta-refresh doet.
//
// Gebruik:
//   npx tsx scripts/push-cards-to-turso.ts "libsql://<jouw-db>.turso.io"
//   npx tsx scripts/push-cards-to-turso.ts "libsql://<jouw-db>.turso.io" --dry-run
//
// Auth: TURSO_AUTH_TOKEN uit .env (niet in argumenten / chat).

import "dotenv/config";
import { createClient, type InStatement } from "@libsql/client";
import { prisma } from "../src/lib/prisma";

const BATCH = 500;

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => a.startsWith("libsql://"));
  const dryRun = args.includes("--dry-run");
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("❌ Geef de Turso database-URL als argument mee.");
    console.error('   Voorbeeld: npx tsx scripts/push-cards-to-turso.ts "libsql://my-db.turso.io"');
    process.exit(1);
  }
  if (!dryRun && !authToken) {
    console.error("❌ Zet TURSO_AUTH_TOKEN in je .env-bestand.");
    process.exit(1);
  }

  const client = dryRun ? null : createClient({ url, authToken: authToken! });

  console.log(`→ Doel: ${url}${dryRun ? "  [DRY RUN — geen writes]" : ""}`);
  console.log("");

  // Sanity-check: schema moet er staan
  if (!dryRun) {
    const tables = await client!.execute(
      "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('Category','Series','CardSet','Card')",
    );
    const n = Number(tables.rows[0]?.n ?? 0);
    if (n < 4) {
      console.error(`❌ Turso mist een of meer tabellen (gevonden: ${n}/4). Draai eerst scripts/push-to-turso.ts.`);
      process.exit(1);
    }
  }

  // ─── 1. Categories ─────────────────────────────────────────────
  const categories = await prisma.category.findMany();
  console.log(`[1/4] Category: ${categories.length} rijen`);
  if (!dryRun && categories.length > 0) {
    const stmts: InStatement[] = categories.map((c) => ({
      sql: `INSERT INTO Category (id, name, createdAt)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
      args: [c.id, c.name, iso(c.createdAt)],
    }));
    await client!.batch(stmts, "write");
    console.log(`      ✓ ${categories.length} rijen gepusht`);
  }

  // ─── 2. Series ─────────────────────────────────────────────────
  const series = await prisma.series.findMany();
  console.log(`[2/4] Series: ${series.length} rijen`);
  if (!dryRun && series.length > 0) {
    const stmts: InStatement[] = series.map((s) => ({
      sql: `INSERT INTO Series (id, name, tcgdexSeriesId, logoUrl, categoryId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              tcgdexSeriesId = excluded.tcgdexSeriesId,
              logoUrl = excluded.logoUrl,
              categoryId = excluded.categoryId`,
      args: [s.id, s.name, s.tcgdexSeriesId, s.logoUrl, s.categoryId, iso(s.createdAt)],
    }));
    await client!.batch(stmts, "write");
    console.log(`      ✓ ${series.length} rijen gepusht`);
  }

  // ─── 3. CardSets ───────────────────────────────────────────────
  const sets = await prisma.cardSet.findMany();
  console.log(`[3/4] CardSet: ${sets.length} rijen`);
  if (!dryRun && sets.length > 0) {
    const stmts: InStatement[] = sets.map((s) => ({
      sql: `INSERT INTO CardSet (id, name, tcgdexSetId, pokewalletSetId, pokewalletSetCode,
                                 logoUrl, symbolUrl, releaseDate, cardCount, seriesId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              tcgdexSetId = excluded.tcgdexSetId,
              pokewalletSetId = excluded.pokewalletSetId,
              pokewalletSetCode = excluded.pokewalletSetCode,
              logoUrl = excluded.logoUrl,
              symbolUrl = excluded.symbolUrl,
              releaseDate = excluded.releaseDate,
              cardCount = excluded.cardCount,
              seriesId = excluded.seriesId`,
      args: [
        s.id, s.name, s.tcgdexSetId, s.pokewalletSetId, s.pokewalletSetCode,
        s.logoUrl, s.symbolUrl, s.releaseDate, s.cardCount, s.seriesId, iso(s.createdAt),
      ],
    }));
    await client!.batch(stmts, "write");
    console.log(`      ✓ ${sets.length} rijen gepusht`);
  }

  // ─── 4. Cards (in batches) ─────────────────────────────────────
  const totalCards = await prisma.card.count();
  const numBatches = Math.ceil(totalCards / BATCH);
  console.log(`[4/4] Card: ${totalCards} rijen, ${numBatches} batches van ${BATCH}`);

  // Estimate size for dry-run
  if (dryRun && totalCards > 0) {
    const sample = await prisma.card.findFirst();
    if (sample) {
      const sampleSize = JSON.stringify(sample).length;
      const estTotalMb = (sampleSize * totalCards) / 1024 / 1024;
      console.log(`      ≈ ${estTotalMb.toFixed(1)} MB (ruwe schatting op basis van 1 sample)`);
    }
  }

  let offset = 0;
  let batchIdx = 0;
  while (offset < totalCards) {
    const cards = await prisma.card.findMany({
      orderBy: { id: "asc" },
      skip: offset,
      take: BATCH,
      select: {
        id: true,
        pokewalletId: true,
        localId: true,
        name: true,
        searchName: true,
        cardSetId: true,
        rarity: true,
        hp: true,
        types: true,
        illustrator: true,
        variants: true,
        imageUrl: true,
        imageUrlFull: true,
        gameplayJson: true,
        spriteUrl: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        priceOverrideAvg: true,
        priceOverrideReverseAvg: true,
        priceOverrideReason: true,
      },
    });
    if (cards.length === 0) break;
    batchIdx++;

    if (!dryRun) {
      const stmts: InStatement[] = cards.map((c) => ({
        sql: `INSERT INTO Card (
                id, pokewalletId, localId, name, searchName, cardSetId,
                rarity, hp, types, illustrator, variants,
                imageUrl, imageUrlFull, gameplayJson, spriteUrl,
                viewCount, createdAt, updatedAt,
                priceOverrideAvg, priceOverrideReverseAvg, priceOverrideReason
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                pokewalletId = excluded.pokewalletId,
                localId = excluded.localId,
                name = excluded.name,
                searchName = excluded.searchName,
                cardSetId = excluded.cardSetId,
                rarity = excluded.rarity,
                hp = excluded.hp,
                types = excluded.types,
                illustrator = excluded.illustrator,
                variants = excluded.variants,
                imageUrl = excluded.imageUrl,
                imageUrlFull = excluded.imageUrlFull,
                gameplayJson = excluded.gameplayJson,
                spriteUrl = excluded.spriteUrl,
                priceOverrideAvg = excluded.priceOverrideAvg,
                priceOverrideReverseAvg = excluded.priceOverrideReverseAvg,
                priceOverrideReason = excluded.priceOverrideReason
                /* prijs-cache + viewCount + updatedAt blijven onaangetast — die beheert de daily cron */`,
        args: [
          c.id, c.pokewalletId, c.localId, c.name, c.searchName, c.cardSetId,
          c.rarity, c.hp, c.types, c.illustrator, c.variants,
          c.imageUrl, c.imageUrlFull, c.gameplayJson, c.spriteUrl,
          c.viewCount, iso(c.createdAt), iso(c.updatedAt),
          c.priceOverrideAvg, c.priceOverrideReverseAvg, c.priceOverrideReason,
        ],
      }));
      await client!.batch(stmts, "write");
    }

    offset += cards.length;
    console.log(`      [${String(batchIdx).padStart(String(numBatches).length)}/${numBatches}] ${offset}/${totalCards} gepusht`);
  }

  if (!dryRun) {
    // Verificatie: tel rijen aan beide kanten
    const turso = await client!.execute("SELECT count(*) AS n FROM Card");
    const tursoCount = Number(turso.rows[0]?.n ?? 0);
    console.log("");
    console.log(`✅ Klaar — Turso telt nu ${tursoCount} Card-rijen (lokaal: ${totalCards}).`);
    if (tursoCount !== totalCards) {
      console.log(`⚠️  Verschil van ${Math.abs(tursoCount - totalCards)} rijen. Check of er duplicate IDs zijn of een batch faalde.`);
    }
  } else {
    console.log("");
    console.log(`✅ Dry-run klaar. Verwijder --dry-run om écht te pushen.`);
  }
}

main()
  .catch((err) => {
    console.error("\n❌ Push faalde:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
