// Webwinkelkeur public API client. Gebruikt de openbare `public_code`-key
// die specifiek bedoeld is voor JS/server-integraties (geen gevoelige data).
//
// Endpoint: GET /1.0/ratings_summary.json
// Docs: https://docs.webwinkelkeur.nl/api/

const SHOP_ID = "1215156";
const PUBLIC_CODE = "4c5c4657d1401cd1e79a60bafc6be19a939b25c3b2abe2a2d7bea3c4a1d1b43a";
const API_BASE = "https://dashboard.webwinkelkeur.nl/api/1.0";

export interface WebwinkelkeurSummary {
  amount: number;
  ratingAverage: number;
}

/**
 * Haalt de rating-summary op via de Webwinkelkeur public API.
 * Cached 1 uur via Next.js fetch revalidate — voorkomt API-spam bij elk request.
 * Returnt null bij netwerkfout, non-200 response, of unsuccessful payload.
 */
export async function getWebwinkelkeurSummary(): Promise<WebwinkelkeurSummary | null> {
  try {
    const url = `${API_BASE}/ratings_summary.json?id=${SHOP_ID}&public_code=${PUBLIC_CODE}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status: string;
      data?: { amount: number; rating_average: number };
    };
    if (json.status !== "success" || !json.data) return null;
    return {
      amount: json.data.amount,
      ratingAverage: json.data.rating_average,
    };
  } catch {
    return null;
  }
}
