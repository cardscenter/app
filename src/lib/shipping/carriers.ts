export interface CarrierInfo {
  id: string;
  name: string;
  countries: string[]; // Countries where this carrier operates
}

export const KNOWN_CARRIERS: CarrierInfo[] = [
  { id: "POSTNL", name: "PostNL", countries: ["NL", "BE"] },
  { id: "DHL", name: "DHL", countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "LU", "IE", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR", "MT", "CY"] },
  { id: "DPD", name: "DPD", countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "LU", "IE", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR"] },
  { id: "GLS", name: "GLS", countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR", "IE"] },
  { id: "UPS", name: "UPS", countries: ["NL", "BE", "DE", "AT", "FR", "IT", "ES", "PT", "LU", "IE", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "GR", "MT", "CY"] },
  { id: "BPOST", name: "bpost", countries: ["BE"] },
  { id: "DEUTSCHE_POST", name: "Deutsche Post", countries: ["DE", "AT"] },
  { id: "LA_POSTE", name: "La Poste", countries: ["FR"] },
  { id: "OTHER", name: "Overig", countries: [] },
];

export function getCarriersForCountry(countryCode: string): CarrierInfo[] {
  return KNOWN_CARRIERS.filter(
    (c) => c.countries.length === 0 || c.countries.includes(countryCode)
  );
}
