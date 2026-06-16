// Volledige Europese landenlijst voor de evenementenkalender (Europa-breed).
// BEWUST APART van src/lib/shipping/countries.ts — die is EU-27 en voedt de
// shipping-zones; events spelen ook in VK/CH/NO/etc. Niet samenvoegen.

export interface EventCountry {
  code: string; // ISO-3166-1 alpha-2
  nameNl: string;
  nameEn: string;
}

export const EVENT_COUNTRIES: EventCountry[] = [
  { code: "NL", nameNl: "Nederland", nameEn: "Netherlands" },
  { code: "BE", nameNl: "België", nameEn: "Belgium" },
  { code: "DE", nameNl: "Duitsland", nameEn: "Germany" },
  { code: "FR", nameNl: "Frankrijk", nameEn: "France" },
  { code: "GB", nameNl: "Verenigd Koninkrijk", nameEn: "United Kingdom" },
  { code: "IE", nameNl: "Ierland", nameEn: "Ireland" },
  { code: "LU", nameNl: "Luxemburg", nameEn: "Luxembourg" },
  { code: "AT", nameNl: "Oostenrijk", nameEn: "Austria" },
  { code: "CH", nameNl: "Zwitserland", nameEn: "Switzerland" },
  { code: "LI", nameNl: "Liechtenstein", nameEn: "Liechtenstein" },
  { code: "IT", nameNl: "Italië", nameEn: "Italy" },
  { code: "ES", nameNl: "Spanje", nameEn: "Spain" },
  { code: "PT", nameNl: "Portugal", nameEn: "Portugal" },
  { code: "AD", nameNl: "Andorra", nameEn: "Andorra" },
  { code: "MC", nameNl: "Monaco", nameEn: "Monaco" },
  { code: "SM", nameNl: "San Marino", nameEn: "San Marino" },
  { code: "MT", nameNl: "Malta", nameEn: "Malta" },
  { code: "CY", nameNl: "Cyprus", nameEn: "Cyprus" },
  { code: "GR", nameNl: "Griekenland", nameEn: "Greece" },
  { code: "DK", nameNl: "Denemarken", nameEn: "Denmark" },
  { code: "SE", nameNl: "Zweden", nameEn: "Sweden" },
  { code: "NO", nameNl: "Noorwegen", nameEn: "Norway" },
  { code: "FI", nameNl: "Finland", nameEn: "Finland" },
  { code: "IS", nameNl: "IJsland", nameEn: "Iceland" },
  { code: "EE", nameNl: "Estland", nameEn: "Estonia" },
  { code: "LV", nameNl: "Letland", nameEn: "Latvia" },
  { code: "LT", nameNl: "Litouwen", nameEn: "Lithuania" },
  { code: "PL", nameNl: "Polen", nameEn: "Poland" },
  { code: "CZ", nameNl: "Tsjechië", nameEn: "Czech Republic" },
  { code: "SK", nameNl: "Slowakije", nameEn: "Slovakia" },
  { code: "HU", nameNl: "Hongarije", nameEn: "Hungary" },
  { code: "SI", nameNl: "Slovenië", nameEn: "Slovenia" },
  { code: "HR", nameNl: "Kroatië", nameEn: "Croatia" },
  { code: "RO", nameNl: "Roemenië", nameEn: "Romania" },
  { code: "BG", nameNl: "Bulgarije", nameEn: "Bulgaria" },
  { code: "RS", nameNl: "Servië", nameEn: "Serbia" },
  { code: "BA", nameNl: "Bosnië en Herzegovina", nameEn: "Bosnia and Herzegovina" },
  { code: "ME", nameNl: "Montenegro", nameEn: "Montenegro" },
  { code: "MK", nameNl: "Noord-Macedonië", nameEn: "North Macedonia" },
  { code: "AL", nameNl: "Albanië", nameEn: "Albania" },
  { code: "XK", nameNl: "Kosovo", nameEn: "Kosovo" },
];

export const EVENT_COUNTRY_CODES = EVENT_COUNTRIES.map((c) => c.code);

export function getEventCountryName(code: string, locale: string): string {
  const country = EVENT_COUNTRIES.find((c) => c.code === code);
  if (!country) return code;
  return locale === "en" ? country.nameEn : country.nameNl;
}

export function isEventCountryCode(code: string): boolean {
  return EVENT_COUNTRY_CODES.includes(code);
}
