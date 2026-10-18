import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MAX_OCCUPANCY } from "@/lib/shop-events/config";

/**
 * Runtime-lezer voor `AppConfig` (Community Hub, Fase 3). Waarden zijn JSON;
 * 30 seconden gecachet per proces zodat de events-pagina's niet per request
 * de instellingen-tabel raken. Admin-schrijfpad: `updateHubSettings` in
 * `src/actions/admin/shop-events.ts` (maakt de cache leeg).
 */

export const HUB_SETTING_KEYS = {
  maxOccupancy: "hub.maxOccupancy",
  openingHours: "hub.openingHours",
  cancellationPolicy: "hub.cancellationPolicy",
  eventInfo: "hub.eventInfo",
  // Fase 5: info-pagina + loyaliteit
  houseRules: "hub.houseRules",
  directions: "hub.directions",
  stampsPerCard: "hub.stampsPerCard",
  pointsPerCheckIn: "hub.pointsPerCheckIn",
  pointsPerFullCard: "hub.pointsPerFullCard",
  stampReward: "hub.stampReward",
  pointsPerEuroFood: "hub.pointsPerEuroFood",
} as const;

export interface HubSettings {
  /** Pand-maximum: harde bovengrens voor elk event (0 = geen limiet). */
  maxOccupancy: number;
  /** Vrije tekst, regels gescheiden door \n (Fase 5 toont ze op de info-pagina). */
  openingHours: string;
  /** Annuleringsbeleid: staat onder elk event en in de bevestigingsmail. */
  cancellationPolicy: string;
  /** Algemene info die onder elk event staat (bereikbaarheid, parkeren, ...). */
  eventInfo: string;
  /** Huisregels (info-pagina), lege regel = nieuwe alinea. */
  houseRules: string;
  /** Bereikbaarheid en parkeren (info-pagina). */
  directions: string;
  /** Stempels per volle kaart. */
  stampsPerCard: number;
  /** Spaarpunten per check-in (0 = uit). 1 punt = 1 cent korting op eten. */
  pointsPerCheckIn: number;
  /** Bonuspunten bij een volle stempelkaart (0 = uit). */
  pointsPerFullCard: number;
  /** Optionele extra beloning bij een volle kaart naast de bonuspunten (tekst, leeg = geen). */
  stampReward: string;
  /** Spaarpunten per betaalde euro aan eten (0 = uit). */
  pointsPerEuroFood: number;
}

export const DEFAULT_HUB_SETTINGS: HubSettings = {
  maxOccupancy: DEFAULT_MAX_OCCUPANCY,
  openingHours: "Nog niet bekend. We openen rond de zomer van 2027.",
  cancellationPolicy:
    "Annuleren kan tot 24 uur voor de start van het event. Je krijgt dan het volledige bedrag terug op de rekening waarmee je betaald hebt. Daarna is terugbetaling niet meer mogelijk, tenzij het event door ons wordt geannuleerd.",
  eventInfo:
    "Cards Center, Dubbele Poort 7, Hulst. Kom op tijd: inchecken kan tot de start. Onder de 12 jaar alleen met begeleiding van een volwassene.",
  houseRules: [
    "Respect voor elkaar, voor de kaarten en voor de ruimte. Iedereen is welkom, ongeacht niveau of leeftijd.",
    "Eigen eten en drinken is niet toegestaan. Aan de bar bestel je via de QR-code op je tafel.",
    "Speeltafels zijn voor spelers. Pak je spullen op als je klaar bent, zodat de volgende kan spelen.",
    "Geen alcohol en niet roken in het pand. Buiten roken alleen op de aangewezen plek.",
    "Handel tussen leden regel je onderling. Cards Center is geen partij bij ruilen of verkopen op de vloer.",
    "Verlies, diefstal of beschadiging van eigen kaarten is voor eigen risico. Laat niets onbeheerd achter.",
    "Onder de 12 jaar alleen onder begeleiding van een volwassene. Ouders van spelers onder de 16 geven vooraf toestemming via het account.",
    "Staff heeft het laatste woord. Wie de sfeer verpest kan gevraagd worden te vertrekken; bij herhaling kan het account geschorst worden.",
  ].join("\n\n"),
  directions: [
    "Cards Center zit op Dubbele Poort 7 in het centrum van Hulst, op loopafstand van de Grote Markt.",
    "Auto: parkeren kan op de bolwerken rond de vesting (zoals het Oranje Bolwerk en het Nassaubolwerk) en op het 's-Gravenhofplein: € 1,75 per uur, op de bolwerken ook een dagkaart van € 5. Betaald van maandag tot en met zaterdag 10:00 tot 18:00 en zondag 12:00 tot 18:00; buiten de stadswallen parkeer je gratis, met een geldige gehandicaptenparkeerkaart overal. In de straat zelf is weinig ruimte.",
    "Fiets: voor de deur staat geen fietsenrek. Zet je fiets in de fietsenstalling aan de Bierkaai, vlak om de hoek.",
    "Openbaar vervoer: lijnbussen stoppen op busstation Hulst, vanaf daar is het acht minuten lopen (550 meter).",
    "Vanuit België: Hulst ligt vlak over de grens bij Sint-Gillis-Waas en Kieldrecht, ongeveer een halfuur rijden vanaf Antwerpen.",
  ].join("\n\n"),
  stampsPerCard: 10,
  pointsPerCheckIn: 50,
  pointsPerFullCard: 500,
  stampReward: "",
  pointsPerEuroFood: 5,
};

const TTL_MS = 30_000;
let cache: { at: number; value: HubSettings } | null = null;

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (raw === undefined) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return (typeof v === typeof fallback ? (v as T) : fallback);
  } catch {
    return fallback;
  }
}

export async function getHubSettings(): Promise<HubSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: Object.values(HUB_SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const value: HubSettings = {
    maxOccupancy: parseJson<number>(byKey[HUB_SETTING_KEYS.maxOccupancy], DEFAULT_HUB_SETTINGS.maxOccupancy),
    openingHours: parseJson<string>(byKey[HUB_SETTING_KEYS.openingHours], DEFAULT_HUB_SETTINGS.openingHours),
    cancellationPolicy: parseJson<string>(byKey[HUB_SETTING_KEYS.cancellationPolicy], DEFAULT_HUB_SETTINGS.cancellationPolicy),
    eventInfo: parseJson<string>(byKey[HUB_SETTING_KEYS.eventInfo], DEFAULT_HUB_SETTINGS.eventInfo),
    houseRules: parseJson<string>(byKey[HUB_SETTING_KEYS.houseRules], DEFAULT_HUB_SETTINGS.houseRules),
    directions: parseJson<string>(byKey[HUB_SETTING_KEYS.directions], DEFAULT_HUB_SETTINGS.directions),
    stampsPerCard: parseJson<number>(byKey[HUB_SETTING_KEYS.stampsPerCard], DEFAULT_HUB_SETTINGS.stampsPerCard),
    pointsPerCheckIn: parseJson<number>(byKey[HUB_SETTING_KEYS.pointsPerCheckIn], DEFAULT_HUB_SETTINGS.pointsPerCheckIn),
    pointsPerFullCard: parseJson<number>(byKey[HUB_SETTING_KEYS.pointsPerFullCard], DEFAULT_HUB_SETTINGS.pointsPerFullCard),
    stampReward: parseJson<string>(byKey[HUB_SETTING_KEYS.stampReward], DEFAULT_HUB_SETTINGS.stampReward),
    pointsPerEuroFood: parseJson<number>(byKey[HUB_SETTING_KEYS.pointsPerEuroFood], DEFAULT_HUB_SETTINGS.pointsPerEuroFood),
  };
  cache = { at: Date.now(), value };
  return value;
}

/** Pand-maximum als getal of null (0/negatief = geen limiet). */
export async function getMaxOccupancy(): Promise<number | null> {
  const s = await getHubSettings();
  return s.maxOccupancy > 0 ? s.maxOccupancy : null;
}

export async function writeHubSettings(partial: Partial<HubSettings>): Promise<void> {
  const entries = Object.entries(partial) as Array<[keyof HubSettings, HubSettings[keyof HubSettings]]>;
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    const key = HUB_SETTING_KEYS[k];
    await prisma.appConfig.upsert({
      where: { key },
      create: { key, value: JSON.stringify(v) },
      update: { value: JSON.stringify(v) },
    });
  }
  cache = null;
}

export function invalidateHubSettingsCache(): void {
  cache = null;
}
