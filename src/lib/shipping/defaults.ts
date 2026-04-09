import { COUNTRY_CODES } from "./countries";

// Default methods can only be adjusted up to 250% of their original price
export const DEFAULT_PRICE_MAX_MULTIPLIER = 1.75;

// Lookup table for original default prices by carrier + serviceName
const DEFAULT_PRICES: Record<string, number> = {
  "POSTNL:Briefpost": 1.69,
  "POSTNL:Brievenbuspakket": 4.85,
  "POSTNL:Aangetekend pakket": 10.45,
  "POSTNL:EU Briefpost": 4.5,
  "POSTNL:EU Pakket aangetekend": 15.5,
};

export function getDefaultMaxPrice(carrier: string, serviceName: string): number | null {
  const key = `${carrier}:${serviceName}`;
  const original = DEFAULT_PRICES[key];
  if (original == null) return null; // non-NL defaults have price 0, no cap
  return Math.round(original * DEFAULT_PRICE_MAX_MULTIPLIER * 100) / 100;
}

export interface DefaultShippingMethod {
  carrier: string;
  serviceName: string;
  price: number;
  countries: string[];
  shippingType: "LETTER" | "MAILBOX_PARCEL" | "PARCEL";
  isDefault: true;
  isTracked: boolean;
  isSigned: boolean;
}

const EU_COUNTRIES_EXCEPT_NL = COUNTRY_CODES.filter((c) => c !== "NL");

export function getDefaultShippingMethods(
  userCountry: string
): DefaultShippingMethod[] {
  if (userCountry === "NL") {
    return [
      // Binnenlands (NL only)
      {
        carrier: "POSTNL",
        serviceName: "Briefpost",
        price: 1.69,
        countries: ["NL"],
        shippingType: "LETTER",
        isDefault: true,
        isTracked: false,
        isSigned: false,
      },
      {
        carrier: "POSTNL",
        serviceName: "Brievenbuspakket",
        price: 4.85,
        countries: ["NL"],
        shippingType: "MAILBOX_PARCEL",
        isDefault: true,
        isTracked: true,
        isSigned: false,
      },
      {
        carrier: "POSTNL",
        serviceName: "Aangetekend pakket",
        price: 10.45,
        countries: ["NL"],
        shippingType: "PARCEL",
        isDefault: true,
        isTracked: true,
        isSigned: true,
      },
      // Internationaal (EU behalve NL)
      {
        carrier: "POSTNL",
        serviceName: "EU Briefpost",
        price: 4.5,
        countries: EU_COUNTRIES_EXCEPT_NL,
        shippingType: "LETTER",
        isDefault: true,
        isTracked: false,
        isSigned: false,
      },
      {
        carrier: "POSTNL",
        serviceName: "EU Pakket aangetekend",
        price: 15.5,
        countries: EU_COUNTRIES_EXCEPT_NL,
        shippingType: "PARCEL",
        isDefault: true,
        isTracked: true,
        isSigned: true,
      },
    ];
  }

  // Non-NL EU users: 2 generic methods with price 0 (must be configured)
  return [
    {
      carrier: "OTHER",
      serviceName: "Standaard Verzending",
      price: 0,
      countries: COUNTRY_CODES,
      shippingType: "PARCEL",
      isDefault: true,
      isTracked: true,
      isSigned: false,
    },
    {
      carrier: "OTHER",
      serviceName: "Aangetekende Verzending",
      price: 0,
      countries: COUNTRY_CODES,
      shippingType: "PARCEL",
      isDefault: true,
      isTracked: true,
      isSigned: true,
    },
  ];
}
