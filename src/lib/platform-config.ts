// Centrale bedrijfsgegevens van het platform. Eén bron voor de storten-pagina
// (IBAN), footer, support, voorwaarden, privacy en de inkoop-verzendinstructies.
//
// Puur bestand: geen "use server", geen prisma/auth-imports, zodat zowel
// server- als client-componenten het mogen importeren (zelfde patroon als
// withdrawal-config.ts / pickup-config.ts).
//
// Lege strings bij kvkNumber / vatId betekenen "nog niet bekend" — consumers
// renderen die regel dan niet (zie hasKvk / hasVat). Invullen zodra bekend;
// ze verschijnen dan automatisch in footer, voorwaarden, privacy en support.
import { formatIbanForDisplay } from "@/lib/validations/iban";

export const PLATFORM = {
  name: "Cards Center",
  // Eenmanszaak — géén "B.V.". Wordt o.a. als tenaamstelling getoond.
  legalName: "Cards Center",
  legalForm: "eenmanszaak",
  supportEmail: "info@cards-center.eu",
  address: {
    street: "Oude Drydijck",
    houseNumber: "41",
    postalCode: "4564 CT",
    city: "Sint Jansteen",
    country: "Nederland",
    countryCode: "NL",
  },
  bank: {
    iban: "NL94RABO0361380593",
    bic: "RABONL2U",
    accountHolder: "Cards Center",
  },
  kvkNumber: "",
  vatId: "",
} as const;

/** IBAN in leesbare groepen van 4: "NL94 RABO 0361 3805 93". */
export const PLATFORM_IBAN_DISPLAY = formatIbanForDisplay(PLATFORM.bank.iban);

/** "Oude Drydijck 41, 4564 CT Sint Jansteen, Nederland" (separator instelbaar). */
export function formatPlatformAddress(separator = ", "): string {
  const a = PLATFORM.address;
  return [`${a.street} ${a.houseNumber}`, `${a.postalCode} ${a.city}`, a.country].join(separator);
}

export const hasKvk = () => PLATFORM.kvkNumber.length > 0;
export const hasVat = () => PLATFORM.vatId.length > 0;
