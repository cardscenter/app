export interface Country {
  code: string;
  nameNl: string;
  nameEn: string;
}

export const EUROPEAN_COUNTRIES: Country[] = [
  { code: "NL", nameNl: "Nederland", nameEn: "Netherlands" },
  { code: "BE", nameNl: "België", nameEn: "Belgium" },
  { code: "DE", nameNl: "Duitsland", nameEn: "Germany" },
  { code: "FR", nameNl: "Frankrijk", nameEn: "France" },
  { code: "GB", nameNl: "Verenigd Koninkrijk", nameEn: "United Kingdom" },
  { code: "AT", nameNl: "Oostenrijk", nameEn: "Austria" },
  { code: "CH", nameNl: "Zwitserland", nameEn: "Switzerland" },
  { code: "IT", nameNl: "Italië", nameEn: "Italy" },
  { code: "ES", nameNl: "Spanje", nameEn: "Spain" },
  { code: "PT", nameNl: "Portugal", nameEn: "Portugal" },
  { code: "LU", nameNl: "Luxemburg", nameEn: "Luxembourg" },
  { code: "IE", nameNl: "Ierland", nameEn: "Ireland" },
  { code: "DK", nameNl: "Denemarken", nameEn: "Denmark" },
  { code: "SE", nameNl: "Zweden", nameEn: "Sweden" },
  { code: "FI", nameNl: "Finland", nameEn: "Finland" },
  { code: "NO", nameNl: "Noorwegen", nameEn: "Norway" },
  { code: "PL", nameNl: "Polen", nameEn: "Poland" },
  { code: "CZ", nameNl: "Tsjechië", nameEn: "Czech Republic" },
  { code: "SK", nameNl: "Slowakije", nameEn: "Slovakia" },
  { code: "HU", nameNl: "Hongarije", nameEn: "Hungary" },
  { code: "RO", nameNl: "Roemenië", nameEn: "Romania" },
  { code: "BG", nameNl: "Bulgarije", nameEn: "Bulgaria" },
  { code: "HR", nameNl: "Kroatië", nameEn: "Croatia" },
  { code: "SI", nameNl: "Slovenië", nameEn: "Slovenia" },
  { code: "EE", nameNl: "Estland", nameEn: "Estonia" },
  { code: "LV", nameNl: "Letland", nameEn: "Latvia" },
  { code: "LT", nameNl: "Litouwen", nameEn: "Lithuania" },
  { code: "GR", nameNl: "Griekenland", nameEn: "Greece" },
  { code: "MT", nameNl: "Malta", nameEn: "Malta" },
  { code: "CY", nameNl: "Cyprus", nameEn: "Cyprus" },
];

export const COUNTRY_CODES = EUROPEAN_COUNTRIES.map((c) => c.code);

export function getCountryName(code: string, locale: string): string {
  const country = EUROPEAN_COUNTRIES.find((c) => c.code === code);
  if (!country) return code;
  return locale === "en" ? country.nameEn : country.nameNl;
}
