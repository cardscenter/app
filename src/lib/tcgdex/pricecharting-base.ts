// Scrape PriceCharting's product page for the base printing of a card (not
// a pattern variant — that's handled by pricecharting-variants.ts). Used as
// a third data source for high-value cards (>=€250) where CardMarket's
// daily avg swings wildly on individual sales and we need corroborating
// evidence for the true market level.
//
// PriceCharting product URLs follow a stable pattern:
//   /game/pokemon-{set-slug}/{card-name-slug}-{local-id}
//
// If the slug misses, PriceCharting redirects to its search page — which
// we detect by sniffing the final URL.

const PC_BASE = "https://www.pricecharting.com/game/pokemon";
const PC_TTL = 60 * 60 * 24; // 24h — PriceCharting updates at least daily
const USD_TO_EUR = 0.92;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

/** Slugify a card name the way PriceCharting does in their URLs. See
 * pricecharting-variants.ts for the original derivation of this function —
 * apostrophes round-trip as `%27`, periods are stripped, accents removed. */
function slugifyCardName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9'-]/g, "");
  return cleaned.replace(/'/g, "%27");
}

/** Turn our CardSet.name into the slug used in PriceCharting URLs.
 *
 * Most modern Pokémon sets follow "pokemon-{lowercase-name}" where the name
 * is hyphenated. Exceptions (promos, mainline set branding) are covered by
 * the override map below.
 */
const SET_SLUG_OVERRIDES: Record<string, string> = {
  // Add exceptions here as we discover them. Format: tcgdexSetId → pcSlug.
  // The default slugify usually works — only override when it doesn't.
};

export function pcSetSlug(tcgdexSetId: string | null, setName: string): string | null {
  if (tcgdexSetId && SET_SLUG_OVERRIDES[tcgdexSetId]) {
    return SET_SLUG_OVERRIDES[tcgdexSetId];
  }
  if (!setName) return null;
  return setName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || null;
}

function stripLeadingZeros(localId: string): string {
  const trimmed = localId.replace(/^0+/, "");
  return trimmed || "0";
}

function extractUngradedUsd(html: string): number | null {
  // The Ungraded price lives in `<td id="used_price">` wrapping a `<span>`
  // with the dollar value. Same selector used by pricecharting-variants.ts.
  const m = html.match(/id="used_price"[^>]*>\s*<span[^>]*>\s*\$([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fetch the Ungraded NM price for a base card, in EUR. Returns null when
 * the page isn't found or doesn't expose a valid price. */
export async function fetchPriceChartingBase(
  setSlug: string,
  cardName: string,
  localId: string
): Promise<number | null> {
  const nameSlug = slugifyCardName(cardName);
  if (!nameSlug) return null;
  const num = stripLeadingZeros(localId);
  const url = `${PC_BASE}-${setSlug}/${nameSlug}-${num}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: PC_TTL },
      redirect: "follow",
    });
    if (!res.ok) return null;
    // Unknown product → PriceCharting redirects to its search page. We
    // don't want search-page HTML (it has many prices from unrelated
    // products) — only product-page hits are usable.
    if (res.url.includes("/search-products")) return null;
    const html = await res.text();
    const usd = extractUngradedUsd(html);
    if (usd == null) return null;
    return Math.round(usd * USD_TO_EUR * 100) / 100;
  } catch {
    return null;
  }
}
