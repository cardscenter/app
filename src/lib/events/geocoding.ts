import "server-only";
import { getEventCountryName } from "@/lib/events/countries";

// Adres → coördinaten via OpenStreetMap Nominatim (gratis). Server-only.
//
// Gebruikt bij event-create en opnieuw bij admin-approve. Low-volume (achter
// approval-wachtrij) → ruim binnen de Nominatim usage-policy (max ~1 req/sec,
// verplichte identificerende User-Agent). Fail-soft: bij elke fout/timeout
// retourneren we null → het event krijgt geen kaart-pin maar blijft geldig.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Identificeert onze app zoals de Nominatim-policy vereist.
const USER_AGENT = "CardsCenter/1.0 (https://cardscenter.up.railway.app; events)";

export interface GeocodeInput {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string; // ISO-2
}

export interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeoResult | null> {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      addressdetails: "0",
      // Gestructureerde query is nauwkeuriger dan één vrije-tekst-string.
      street: `${input.houseNumber} ${input.street}`.trim(),
      city: input.city,
      postalcode: input.postalCode,
      // Nominatim verwacht de landnaam (Engels werkt betrouwbaar).
      country: getEventCountryName(input.country, "en"),
    });

    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = data[0];
    if (!first?.lat || !first?.lon) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    // Timeout, netwerk-fout, of rate-limit → fail-soft.
    return null;
  }
}
