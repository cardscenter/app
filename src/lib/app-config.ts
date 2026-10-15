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
}

export const DEFAULT_HUB_SETTINGS: HubSettings = {
  maxOccupancy: DEFAULT_MAX_OCCUPANCY,
  openingHours: "Nog niet bekend. We openen rond de zomer van 2027.",
  cancellationPolicy:
    "Annuleren kan tot 24 uur voor de start van het event. Je krijgt dan het volledige bedrag terug op de rekening waarmee je betaald hebt. Daarna is terugbetaling niet meer mogelijk, tenzij het event door ons wordt geannuleerd.",
  eventInfo:
    "Cards Center, Dubbele Poort 7, Hulst. Kom op tijd: inchecken kan tot de start. Onder de 12 jaar alleen met begeleiding van een volwassene.",
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
