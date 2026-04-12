// Fan-art artist registry
// These are fictional artist names assigned to cosmetic items.
// You can add new artists by appending to the ARTISTS array.
// Then assign them to items in prisma/seed-cosmetics.ts using the artist key.

export interface FanArtist {
  key: string;        // Unique identifier
  name: string;       // Display name
  country: string;    // Country of origin (ISO 3166-1 alpha-2)
  countryName: string; // Human-readable country name
}

// Add new artists here. Each must have a unique key.
export const ARTISTS: FanArtist[] = [
  // Netherlands
  { key: "luuk-de-vries", name: "Luuk de Vries", country: "NL", countryName: "Nederland" },
  { key: "sanne-bakker", name: "Sanne Bakker", country: "NL", countryName: "Nederland" },

  // Germany
  { key: "felix-wagner", name: "Felix Wagner", country: "DE", countryName: "Duitsland" },
  { key: "lena-krueger", name: "Lena Kr\u00fcger", country: "DE", countryName: "Duitsland" },

  // France
  { key: "camille-dubois", name: "Camille Dubois", country: "FR", countryName: "Frankrijk" },
  { key: "theo-moreau", name: "Th\u00e9o Moreau", country: "FR", countryName: "Frankrijk" },

  // Spain
  { key: "pablo-ruiz", name: "Pablo Ruiz", country: "ES", countryName: "Spanje" },
  { key: "lucia-fernandez", name: "Luc\u00eda Fern\u00e1ndez", country: "ES", countryName: "Spanje" },

  // Italy
  { key: "marco-rossi", name: "Marco Rossi", country: "IT", countryName: "Itali\u00eb" },
  { key: "giulia-bianchi", name: "Giulia Bianchi", country: "IT", countryName: "Itali\u00eb" },

  // Poland
  { key: "kacper-nowak", name: "Kacper Nowak", country: "PL", countryName: "Polen" },

  // Sweden
  { key: "astrid-lindqvist", name: "Astrid Lindqvist", country: "SE", countryName: "Zweden" },

  // Portugal
  { key: "diogo-silva", name: "Diogo Silva", country: "PT", countryName: "Portugal" },

  // Belgium
  { key: "emile-claes", name: "\u00c9mile Claes", country: "BE", countryName: "Belgi\u00eb" },

  // Czech Republic
  { key: "jakub-dvorak", name: "Jakub Dvo\u0159\u00e1k", country: "CZ", countryName: "Tsjechi\u00eb" },

  // Finland
  { key: "elina-virtanen", name: "Elina Virtanen", country: "FI", countryName: "Finland" },

  // Austria
  { key: "hannah-steiner", name: "Hannah Steiner", country: "AT", countryName: "Oostenrijk" },

  // Denmark
  { key: "oliver-jensen", name: "Oliver Jensen", country: "DK", countryName: "Denemarken" },
];

/** Look up an artist by key. Returns undefined if not found. */
export function getArtist(key: string): FanArtist | undefined {
  return ARTISTS.find((a) => a.key === key);
}

/** Country flag emoji from ISO country code */
export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}
