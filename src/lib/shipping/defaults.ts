import { COUNTRY_CODES } from "./countries";

export interface DefaultShippingMethod {
  carrier: string;
  serviceName: string;
  price: number;
  countries: string[];
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
        isDefault: true,
        isTracked: false,
        isSigned: false,
      },
      {
        carrier: "POSTNL",
        serviceName: "Brievenbuspakket",
        price: 4.85,
        countries: ["NL"],
        isDefault: true,
        isTracked: true,
        isSigned: false,
      },
      {
        carrier: "POSTNL",
        serviceName: "Aangetekend pakket",
        price: 10.45,
        countries: ["NL"],
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
        isDefault: true,
        isTracked: false,
        isSigned: false,
      },
      {
        carrier: "POSTNL",
        serviceName: "EU Pakket aangetekend",
        price: 15.5,
        countries: EU_COUNTRIES_EXCEPT_NL,
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
      isDefault: true,
      isTracked: true,
      isSigned: false,
    },
    {
      carrier: "OTHER",
      serviceName: "Aangetekende Verzending",
      price: 0,
      countries: COUNTRY_CODES,
      isDefault: true,
      isTracked: true,
      isSigned: true,
    },
  ];
}
