// PriceCharting scraper for special reverse-holo variants (Poké Ball /
// Master Ball / Ball / Energy patterns). CardMarket has these as separate
// products but blocks direct scraping (403). PriceCharting publishes them
// on predictable URLs like:
//   /game/pokemon-prismatic-evolutions/umbreon-master-ball-59
// We fetch the product page and parse the "Ungraded" price out of the
// id="used_price" cell.

import type { SpecialVariantConfig, SpecialVariantSetConfig, ExtraVariantsMap } from "./special-variants";

const PC_BASE = "https://www.pricecharting.com/game/pokemon";
const PC_TTL = 60 * 60 * 24; // 24h cache — matches other pricing fetches
const USD_TO_EUR = 0.92;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

/** Slugify a card name the way PriceCharting does in their URLs.
 *
 * Observed patterns:
 *   "Umbreon" → "umbreon"
 *   "Erika's Tangela" → "erika%27s-tangela"
 *   "Mr. Mime" → "mr-mime"   (punctuation stripped, not encoded)
 *
 * Apostrophes get URL-encoded (%27), periods are stripped. Everything else
 * is lowercased with spaces → hyphens.
 */
function slugifyCardName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/\./g, "") // strip periods (e.g. "Mr. Mime" → "mr mime")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9'-]/g, ""); // keep only a-z, digits, apostrophes, hyphens
  // URL-encode the apostrophe back to %27 (encodeURIComponent would also
  // encode the hyphens which PriceCharting wants kept raw).
  return cleaned.replace(/'/g, "%27");
}

/** Strip leading zeros from a local ID: "001" → "1". PC uses unpadded numbers. */
function stripLeadingZeros(localId: string): string {
  const trimmed = localId.replace(/^0+/, "");
  return trimmed || "0";
}

function buildUrl(
  pcSetSlug: string,
  cardName: string,
  localId: string,
  variant: SpecialVariantConfig
): string {
  const nameSlug = slugifyCardName(cardName);
  const num = stripLeadingZeros(localId);
  return `${PC_BASE}-${pcSetSlug}/${nameSlug}-${variant.pcSlug}-${num}`;
}

/** Parse the Ungraded USD price out of a PriceCharting product page. */
function extractUngradedUsd(html: string): number | null {
  // The primary / most reliable target is the id="used_price" cell, which
  // wraps a <span> with the dollar amount. Example:
  //   <td id="used_price" ...><span>$55.82</span>...</td>
  const m = html.match(/id="used_price"[^>]*>\s*<span[^>]*>\s*\$([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fetch one variant's USD price, returns null if page missing / no price. */
async function fetchVariantPriceEur(
  pcSetSlug: string,
  cardName: string,
  localId: string,
  variant: SpecialVariantConfig
): Promise<number | null> {
  const url = buildUrl(pcSetSlug, cardName, localId, variant);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: PC_TTL },
      redirect: "follow",
    });
    if (!res.ok) return null;
    // PriceCharting redirects unknown products to the search page — if the
    // final URL is a search URL, we didn't land on a real product.
    if (res.url.includes("/search-products")) return null;
    const html = await res.text();
    const usd = extractUngradedUsd(html);
    if (usd == null) return null;
    return Math.round(usd * USD_TO_EUR * 100) / 100;
  } catch {
    return null;
  }
}

/** Fetch all configured special-variant prices for a card.
 *
 * Returns a map of variant key → EUR price (only variants with data included).
 * Runs one request per variant, so expect up to 2 sequential HTTP calls. The
 * fetch layer caches each URL for 24h, so repeated calls are free.
 */
export async function fetchExtraVariants(
  cardName: string,
  localId: string,
  setConfig: SpecialVariantSetConfig
): Promise<ExtraVariantsMap> {
  const out: ExtraVariantsMap = {};
  for (const v of setConfig.variants) {
    const eur = await fetchVariantPriceEur(setConfig.pcSetSlug, cardName, localId, v);
    if (eur != null) out[v.key] = eur;
  }
  return out;
}
