// Third-tier fallback when both TCGdex and pokemontcg.io lack data.
// PriceCharting's public search API returns image URLs and USD prices for
// many cards — including brand-new SVP promos that other APIs don't track yet.
//
// Search is fuzzy (name + number match), and results include unrelated cards,
// so we must verify matches strictly before trusting the price.

const PC_BASE = "https://www.pricecharting.com/api/search";
const PC_TTL = 60 * 60 * 24; // 24h cache
const USD_TO_EUR = 0.92;

export interface PriceChartingMatch {
  imageUrl: string | null;
  priceEur: number | null; // loose / ungraded price (closest to NM raw value)
}

interface PCProduct {
  productName: string;
  consoleName: string;
  imageUri?: string;
  price1?: string; // loose
  price2?: string; // PSA 10 (graded)
  price3?: string; // complete/new
}

function parseUsd(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractNumber(productName: string): string | null {
  const m = productName.match(/#(\d+)/);
  return m ? m[1] : null;
}

/** Fetch PriceCharting matches for a card name + local ID */
export async function resolvePriceCharting(
  name: string,
  localId: string
): Promise<PriceChartingMatch | null> {
  // Strip leading zeros: "013" → "13" for matching
  const localIdStripped = localId.replace(/^0+/, "") || "0";
  const q = `${name} ${localIdStripped} promo`;

  let data: { products?: PCProduct[] };
  try {
    const res = await fetch(`${PC_BASE}?q=${encodeURIComponent(q)}&type=json`, {
      next: { revalidate: PC_TTL },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    data = (await res.json()) as { products?: PCProduct[] };
  } catch {
    return null;
  }

  const products = data.products ?? [];
  if (products.length === 0) return null;

  // Strict match: name in productName + consoleName contains "Promo" + number matches
  const nameLower = name.toLowerCase();
  const match = products.find((p) => {
    const pn = p.productName.toLowerCase();
    const cn = p.consoleName.toLowerCase();
    const pcNum = extractNumber(p.productName);
    return (
      pn.includes(nameLower) &&
      cn.includes("promo") &&
      pcNum === localIdStripped
    );
  });

  if (!match) return null;

  // price1 is the "loose/ungraded" price — closest to NM raw card value
  const usd = parseUsd(match.price1);
  const priceEur = usd ? Math.round(usd * USD_TO_EUR * 100) / 100 : null;

  return {
    imageUrl: match.imageUri ?? null,
    priceEur,
  };
}
