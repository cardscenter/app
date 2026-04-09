export interface CarrierInfo {
  id: string;
  name: string;
  countries: string[]; // Countries where this carrier operates
  trackingUrlPattern?: string; // URL pattern with {NUMBER}, {COUNTRY}, {POSTAL_CODE} placeholders
  trackingNumberPlaceholder?: string; // Example tracking number for placeholder text
  needsPostalCode?: boolean; // PostNL needs postal code + country for tracking URL
}

export const KNOWN_CARRIERS: CarrierInfo[] = [
  {
    id: "POSTNL", name: "PostNL", countries: ["NL", "BE"],
    trackingUrlPattern: "https://jouw.postnl.nl/track-and-trace/{NUMBER}-{COUNTRY}-{POSTAL_CODE}",
    trackingNumberPlaceholder: "3SYZXG9226713",
    needsPostalCode: true,
  },
  {
    id: "DHL", name: "DHL",
    countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "LU", "IE", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR", "MT", "CY"],
    trackingUrlPattern: "https://www.dhl.com/nl-nl/home/tracking/tracking-parcel.html?submit=1&tracking-id={NUMBER}",
    trackingNumberPlaceholder: "JVGL1234567890",
  },
  {
    id: "DPD", name: "DPD",
    countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "LU", "IE", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR"],
    trackingUrlPattern: "https://tracking.dpd.de/status/nl_NL/parcel/{NUMBER}",
    trackingNumberPlaceholder: "05212345678912",
  },
  {
    id: "GLS", name: "GLS",
    countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR", "IE"],
    trackingUrlPattern: "https://gls-group.eu/NL/nl/paketverfolgung?match={NUMBER}",
    trackingNumberPlaceholder: "GL123456789",
  },
  {
    id: "UPS", name: "UPS",
    countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "LU", "IE", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR", "MT", "CY"],
    trackingUrlPattern: "https://www.ups.com/track?loc=nl_NL&tracknum={NUMBER}",
    trackingNumberPlaceholder: "1Z999AA10123456784",
  },
  {
    id: "BPOST", name: "bpost", countries: ["BE"],
    trackingUrlPattern: "https://track.bpost.cloud/btr/web/#/search?itemCode={NUMBER}",
    trackingNumberPlaceholder: "323212345678901234",
  },
  {
    id: "DEUTSCHE_POST", name: "Deutsche Post", countries: ["DE", "AT"],
    trackingUrlPattern: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={NUMBER}",
    trackingNumberPlaceholder: "00340434161094042557",
  },
  {
    id: "LA_POSTE", name: "La Poste", countries: ["FR"],
    trackingUrlPattern: "https://www.laposte.fr/outils/suivre-vos-envois?code={NUMBER}",
    trackingNumberPlaceholder: "6A12345678901",
  },
  { id: "OTHER", name: "Overig", countries: [] },
];

export function getCarriersForCountry(countryCode: string): CarrierInfo[] {
  return KNOWN_CARRIERS.filter(
    (c) => c.countries.length === 0 || c.countries.includes(countryCode)
  );
}

export function getCarrierById(carrierId: string): CarrierInfo | undefined {
  return KNOWN_CARRIERS.find((c) => c.id === carrierId);
}

/**
 * Build a tracking URL from a carrier ID, tracking number, and optional buyer address info.
 * Returns null if the carrier has no tracking URL pattern.
 */
export function buildTrackingUrl(
  carrierId: string,
  trackingNumber: string,
  buyerCountry?: string | null,
  buyerPostalCode?: string | null,
): string | null {
  const carrier = getCarrierById(carrierId);
  if (!carrier?.trackingUrlPattern) return null;

  return carrier.trackingUrlPattern
    .replace("{NUMBER}", encodeURIComponent(trackingNumber))
    .replace("{COUNTRY}", buyerCountry ?? "NL")
    .replace("{POSTAL_CODE}", (buyerPostalCode ?? "").replace(/\s/g, ""));
}

/**
 * Check if a string looks like a URL (starts with http:// or https://)
 */
export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
