import type { Prisma } from "@prisma/client";
import {
  EVENT_TYPES,
  BEURS_EVENT_TYPES,
  OTHER_EVENT_TYPES,
  type EventType,
} from "@/lib/events/types";
import { EVENT_COUNTRY_CODES } from "@/lib/events/countries";

// Filter-types voor de evenementen-overzichtspagina (parallel aan
// auction-filters.ts). In sync met EventFilterSidebar én buildEventFilterWhere.

export type EventTab = "beurzen" | "events";
export type EventViewMode = "month" | "list" | "map";

export const EVENT_RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;
export type EventRadius = (typeof EVENT_RADIUS_OPTIONS)[number];

export interface EventFilters {
  tab: EventTab;
  view: EventViewMode;
  country: string | null;
  // Verfijning binnen de Events-tab (Beurzen-tab toont sowieso alleen beurzen).
  types: EventType[];
  dateFrom: string | null; // "yyyy-MM-dd"
  dateTo: string | null;
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

  return {
    tab,
    view,
    country,
    types: parseList(pick("type"), EVENT_TYPES),
    dateFrom: parseDate(pick("date_from")),
    dateTo: parseDate(pick("date_to")),
    radius,
    officialOnly: pick("official") === "1",
    freeOnly: pick("free") === "1",
  };
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

  if (filters.dateFrom || filters.dateTo) {
    where.startTime = {};
    if (filters.dateFrom) {
      where.startTime.gte = new Date(`${filters.dateFrom}T00:00:00`);
    }
    if (filters.dateTo) {
      where.startTime.lte = new Date(`${filters.dateTo}T23:59:59`);
    }
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
  if (filters.dateFrom) n++;
  if (filters.dateTo) n++;
  if (filters.radius !== null) n++;
  if (filters.officialOnly) n++;
  if (filters.freeOnly) n++;
  return n;
}
