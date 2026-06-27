import type { Prisma } from "@prisma/client";
import {
  EVENT_TYPES,
  BEURS_EVENT_TYPES,
  OTHER_EVENT_TYPES,
  ACTIVITY_KEYS,
  type EventType,
  type FacilityKey,
} from "@/lib/events/types";
import { EVENT_COUNTRY_CODES } from "@/lib/events/countries";

// Filter-types voor de evenementen-overzichtspagina (parallel aan
// auction-filters.ts). In sync met EventFilterSidebar én buildEventFilterWhere.

export type EventTab = "beurzen" | "events";
export type EventViewMode = "month" | "list" | "map";

export const EVENT_RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;
export type EventRadius = (typeof EVENT_RADIUS_OPTIONS)[number];

// Toekomstgerichte snel-presets voor de datum-filter (parallel aan het
// "Aangeboden sinds"-patroon van de andere sidebars, maar vooruit i.p.v.
// terug). De custom van/tot-range blijft als verfijning beschikbaar.
export const EVENT_DATE_PRESETS = ["week", "weekend", "month", "quarter"] as const;
export type EventDatePreset = (typeof EVENT_DATE_PRESETS)[number];
export const EVENT_DATE_PRESET_LABELS_NL: Record<EventDatePreset, string> = {
  week: "Komende 7 dagen",
  weekend: "Dit weekend",
  month: "Deze maand",
  quarter: "Komende 3 maanden",
};

export interface EventFilters {
  tab: EventTab;
  view: EventViewMode;
  country: string | null;
  // Verfijning binnen de Events-tab (Beurzen-tab toont sowieso alleen beurzen).
  types: EventType[];
  datePreset: EventDatePreset | null;
  dateFrom: string | null; // "yyyy-MM-dd"
  dateTo: string | null;
  activities: FacilityKey[]; // subset van ACTIVITY_KEYS (canPlay/canTrade/canSell)
  radius: EventRadius | null;
  officialOnly: boolean; // alleen Cards Center "geverifieerde" events
  freeOnly: boolean; // alleen gratis entree
}

function parseList<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return allowed.filter((v) => set.has(v));
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/** Parse event-filters uit Next.js searchParams. Onbekende/ongeldige waardes
 *  vallen netjes terug op default. */
export function parseEventFilters(
  sp: Record<string, string | string[] | undefined>,
): EventFilters {
  function pick(key: string): string | undefined {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  }

  const tab: EventTab = pick("tab") === "events" ? "events" : "beurzen";

  const viewRaw = pick("view");
  const view: EventViewMode =
    viewRaw === "month" || viewRaw === "map" ? viewRaw : "list";

  const countryRaw = pick("country");
  const country =
    countryRaw && EVENT_COUNTRY_CODES.includes(countryRaw) ? countryRaw : null;

  const radiusRaw = Number(pick("radius"));
  const radius =
    Number.isFinite(radiusRaw) &&
    (EVENT_RADIUS_OPTIONS as readonly number[]).includes(radiusRaw)
      ? (radiusRaw as EventRadius)
      : null;

  const presetRaw = pick("date_preset");
  const datePreset =
    presetRaw && (EVENT_DATE_PRESETS as readonly string[]).includes(presetRaw)
      ? (presetRaw as EventDatePreset)
      : null;

  return {
    tab,
    view,
    country,
    types: parseList(pick("type"), EVENT_TYPES),
    datePreset,
    dateFrom: parseDate(pick("date_from")),
    dateTo: parseDate(pick("date_to")),
    activities: parseList(pick("activities"), ACTIVITY_KEYS),
    radius,
    officialOnly: pick("official") === "1",
    freeOnly: pick("free") === "1",
  };
}

/** Vertaal een datum-preset naar een [start, end]-venster (server-side, t.o.v.
 *  het moment van aanroep). Past op `Event.startTime`. Het verleden-deel wordt
 *  toch al weggefilterd door de page (`endTime >= now`). */
function presetToRange(preset: EventDatePreset, now: Date): { gte: Date; lte: Date } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "weekend") {
    const dow = now.getDay(); // 0=zo .. 6=za
    // Zaterdag van het huidige/eerstvolgende weekend. Zondag telt als lopend
    // weekend (sat = gisteren) zodat "dit weekend" op zondag niet leeg is.
    const daysUntilSat = dow === 0 ? -1 : 6 - dow;
    const sat = new Date(startOfToday);
    sat.setDate(sat.getDate() + daysUntilSat);
    const sun = new Date(sat);
    sun.setDate(sun.getDate() + 1);
    sun.setHours(23, 59, 59, 999);
    return { gte: sat, lte: sun };
  }
  if (preset === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { gte: now, lte: end };
  }
  if (preset === "month") {
    // Rest van de huidige kalendermaand.
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { gte: now, lte: end };
  }
  // quarter — komende 3 maanden (~90 dagen).
  const end = new Date(now);
  end.setDate(end.getDate() + 90);
  return { gte: now, lte: end };
}

/** Build een Prisma-where fragment. Combineer met status + blocking via spread.
 *  Radius doet de page in JS (haversine). De `tab` bepaalt de basis-type-set;
 *  binnen Events kan `types` verder verfijnen. */
export function buildEventFilterWhere(filters: EventFilters): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {};

  // Basis-type-set uit de tab, eventueel verfijnd met expliciete types.
  const baseTypes: EventType[] =
    filters.tab === "beurzen" ? BEURS_EVENT_TYPES : OTHER_EVENT_TYPES;
  const effectiveTypes =
    filters.types.length > 0
      ? filters.types.filter((t) => baseTypes.includes(t))
      : baseTypes;
  where.eventType = { in: effectiveTypes };

  if (filters.country) {
    where.country = filters.country;
  }

  // Datum: een preset heeft voorrang op de custom van/tot-range (UI laat ook
  // maar één van beide tegelijk toe).
  if (filters.datePreset) {
    where.startTime = presetToRange(filters.datePreset, new Date());
  } else if (filters.dateFrom || filters.dateTo) {
    where.startTime = {};
    if (filters.dateFrom) {
      where.startTime.gte = new Date(`${filters.dateFrom}T00:00:00`);
    }
    if (filters.dateTo) {
      where.startTime.lte = new Date(`${filters.dateTo}T23:59:59`);
    }
  }

  // Activiteiten — elk geselecteerd vereist dat de bijbehorende Boolean true is.
  if (filters.activities.length > 0) {
    where.AND = filters.activities.map((key) => ({ [key]: true }) as Prisma.EventWhereInput);
  }

  if (filters.officialOnly) {
    where.isOfficial = true;
  }

  if (filters.freeOnly) {
    where.entryType = "FREE";
  }

  return where;
}

/** Aantal actieve filters (excl. tab + view). Voor de counter + "Wis filters". */
export function countActiveEventFilters(filters: EventFilters): number {
  let n = 0;
  if (filters.country) n++;
  if (filters.types.length > 0) n++;
  if (filters.datePreset) n++;
  if (filters.dateFrom) n++;
  if (filters.dateTo) n++;
  if (filters.activities.length > 0) n++;
  if (filters.radius !== null) n++;
  if (filters.officialOnly) n++;
  if (filters.freeOnly) n++;
  return n;
}
