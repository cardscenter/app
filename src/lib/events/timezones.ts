// Tijdzone-helpers voor de evenementenkalender. Events worden Europa-breed
// aangemaakt: de organisator voert datum + begin/eindtijd in als event-LOKALE
// wandklok-tijd, wij leiden de IANA-tijdzone af uit het land en slaan UTC op.
// Bezoekers zien de tijd in de event-tijdzone mét label (bv. "20:00 CEST").
//
// Geen externe dep — Intl.DateTimeFormat met `timeZone` levert de DST-correcte
// offset per kalenderdag. Generalisatie van src/lib/auction/timing.ts (dat
// vast op Europe/Amsterdam zit).
//
// Client-safe (geen Prisma): de wizard gebruikt formatInTimeZone voor preview,
// de server-action gebruikt zonedWallClockToUtc bij opslaan.

// Eén representatieve IANA-tijdzone per Europees land. Voor landen die meerdere
// tijdzones hebben (ES Canarische eilanden, PT Azoren) kiezen we het vasteland —
// ruim voldoende voor een community-beurzenkalender.
export const COUNTRY_TIMEZONE: Record<string, string> = {
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  LU: "Europe/Luxembourg",
  AT: "Europe/Vienna",
  CH: "Europe/Zurich",
  LI: "Europe/Vaduz",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  AD: "Europe/Andorra",
  MC: "Europe/Monaco",
  SM: "Europe/San_Marino",
  MT: "Europe/Malta",
  CY: "Asia/Nicosia",
  GR: "Europe/Athens",
  DK: "Europe/Copenhagen",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  IS: "Atlantic/Reykjavik",
  EE: "Europe/Tallinn",
  LV: "Europe/Riga",
  LT: "Europe/Vilnius",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
  SK: "Europe/Bratislava",
  HU: "Europe/Budapest",
  SI: "Europe/Ljubljana",
  HR: "Europe/Zagreb",
  RO: "Europe/Bucharest",
  BG: "Europe/Sofia",
  RS: "Europe/Belgrade",
  BA: "Europe/Sarajevo",
  ME: "Europe/Podgorica",
  MK: "Europe/Skopje",
  AL: "Europe/Tirane",
  XK: "Europe/Belgrade",
};

export const DEFAULT_EVENT_TIMEZONE = "Europe/Amsterdam";

/** Leid de IANA-tijdzone af uit een ISO-2 landcode. Onbekend → NL-default. */
export function timezoneForCountry(countryCode: string): string {
  return COUNTRY_TIMEZONE[countryCode] ?? DEFAULT_EVENT_TIMEZONE;
}

/**
 * Bepaal de UTC-offset (in minuten) van `timeZone` op een specifieke
 * wandklok-tijd. Zelfde techniek als getNLOffsetMinutes in auction/timing.ts,
 * maar voor een willekeurige IANA-tijdzone.
 */
function getOffsetMinutes(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const tzYear = get("year");
  const tzMonth = get("month");
  const tzDay = get("day");
  let tzHour = get("hour");
  if (tzHour === 24) tzHour = 0;
  const tzMinute = get("minute");

  const tzAsUtcMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute);
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  return Math.round((tzAsUtcMs - wallAsUtcMs) / 60000);
}

/**
 * Combineer een datum ("yyyy-MM-dd") + tijd ("HH:mm") — geïnterpreteerd als
 * wandklok in `timeZone` — tot een echte UTC-Date. DST-correct. Retourneert
 * Invalid Date bij onparseerbare input.
 */
export function zonedWallClockToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  if (!dateStr || !timeStr) return new Date(NaN);
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    return new Date(NaN);
  }
  const offsetMin = getOffsetMinutes(timeZone, year, month, day, hour, minute);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMin * 60000;
  return new Date(utcMs);
}

/** Korte tijdzone-afkorting voor een instant (bv. "CEST", "GMT", "EET"). */
export function timeZoneAbbreviation(
  date: Date,
  timeZone: string,
  locale: string = "nl-NL",
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: "short",
    hour: "2-digit",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * Format een UTC-Date in de event-tijdzone. Voorbeeld:
 * "vrijdag 5 juni · 10:00–17:00 (CEST)".
 */
export function formatEventDateRange(
  start: Date,
  end: Date,
  timeZone: string,
  locale: string = "nl-NL",
): string {
  const dateFmt = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const tz = timeZoneAbbreviation(start, timeZone, locale);
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)} (${tz})`;
}

/** Alleen de tijd in event-tijdzone met label, bv. "10:00 (CEST)". */
export function formatEventTime(
  date: Date,
  timeZone: string,
  locale: string = "nl-NL",
): string {
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${time} (${timeZoneAbbreviation(date, timeZone, locale)})`;
}
