// Beeld-mirror: PokeWallet → R2 (prod) / schijf (lokaal).
//
// Weerbaarheid tegen TCGdex-storingen (2026-07-04): kaart- en set-beelden
// hotlinkten naar assets.tcgdex.net. We mirroren ze nu één keer naar onze
// eigen opslag en serveren via het bestaande /api/uploads/{filename}-contract.
//
// Deze module is puur "fetch + put + geef de key-stem terug" — de aanroeper
// (cron-stap of backfill-script) beslist WELKE kaarten/sets en schrijft de
// resulterende stem naar Card.imageMirrorKey / CardSet.logoMirrorKey. Zo blijft
// de module zonder Prisma-afhankelijkheid en makkelijk te testen.
//
// Bewust GEEN moderatie (upload.ts-flow modereert user-uploads) — de catalogus
// is vertrouwde content. Bewust deterministische keys (geen random) zodat de
// mirror idempotent is en de render-URL uit de opgeslagen stem te bouwen valt.

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { isR2Configured, r2PutObject } from "@/lib/r2";
import { fetchCardImage, fetchSetLogo } from "@/lib/pokewallet/client";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

/**
 * Maakt een Card.id / set-id veilig als vlakke bestandsnaam-stem. De serve-route
 * weigert alleen `/ \ ..`; puntjes/streepjes mogen. `Card.id` is TCGdex-stijl
 * ("base1-4", "sv08.5-SV1") en normaal al veilig — deze guard vangt uitzonderingen.
 */
function safeStemId(id: string): string {
  return /^[A-Za-z0-9._-]+$/.test(id) ? id : id.replace(/[^A-Za-z0-9._-]+/g, "-");
}

async function putMirrorObject(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  if (isR2Configured()) {
    await r2PutObject(key, buffer, contentType);
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, key), buffer);
  }
}

/**
 * Mirrort de low+high kaartafbeelding. Retourneert de key-stem (bv. "card-base1-4")
 * om in `Card.imageMirrorKey` te zetten, of null als er geen beeld te halen was.
 *
 * Als één van beide sizes ontbreekt gebruiken we de aanwezige voor béide keys,
 * zodat de render nooit een 404 op `-low`/`-high` krijgt zodra imageMirrorKey gezet is.
 */
export async function mirrorCardImage(card: {
  id: string;
  pokewalletId: string | null;
}): Promise<string | null> {
  if (!card.pokewalletId) return null;
  const stem = `card-${safeStemId(card.id)}`;

  const [low, high] = await Promise.all([
    fetchCardImage(card.pokewalletId, "low"),
    fetchCardImage(card.pokewalletId, "high"),
  ]);

  const lowImg = low ?? high;
  const highImg = high ?? low;
  if (!lowImg || !highImg) return null; // niets te mirroren

  await putMirrorObject(`${stem}-low.jpg`, lowImg.buffer, "image/jpeg");
  await putMirrorObject(`${stem}-high.jpg`, highImg.buffer, "image/jpeg");
  return stem;
}

/**
 * Mirrort het set-logo. Retourneert de key-stem (bv. "set-24325") om in
 * `CardSet.logoMirrorKey` te zetten, of null als er geen logo was.
 */
export async function mirrorSetLogo(set: {
  pokewalletSetId: string | null;
}): Promise<string | null> {
  if (!set.pokewalletSetId) return null;
  const stem = `set-${safeStemId(set.pokewalletSetId)}`;

  const img = await fetchSetLogo(set.pokewalletSetId);
  if (!img) return null;

  await putMirrorObject(`${stem}.png`, img.buffer, "image/png");
  return stem;
}

/**
 * Gepacede batch-runner om onder de PokeWallet-limiet (5000/uur) te blijven.
 * Verwerkt `concurrency` items tegelijk met `sleepMs` pauze tussen batches.
 * Aanroepers stemmen de knoppen af op hun call-volume (bulk = conservatief).
 */
export async function mapPaced<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  opts: { concurrency?: number; sleepMs?: number } = {},
): Promise<R[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const sleepMs = opts.sleepMs ?? 500;
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.all(batch.map((item, j) => fn(item, i + j)));
    results.push(...settled);
    if (i + concurrency < items.length && sleepMs > 0) {
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
  return results;
}
