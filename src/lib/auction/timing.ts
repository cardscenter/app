/**
 * Auction-timing helpers — vaste-tijdzone marketplace-conventie
 * (Europe/Amsterdam) voor het samenstellen van start/end-times uit
 * de form-inputs `startDate` + `duration` + `endTimeOfDay`.
 *
 * Geen externe dep nodig — `Intl.DateTimeFormat` met `timeZone` levert
 * de DST-correcte offset (CET +01:00 / CEST +02:00) per kalenderdag.
 * Belangrijk voor 14-daagse veilingen die over de DST-switch (laatste
 * zondag van maart of oktober) lopen — start- en endTime kunnen dan
 * een verschillende UTC-offset hebben.
 */

const NL_TIMEZONE = "Europe/Amsterdam";

/**
 * Bepaal de UTC-offset (in minuten) van Europe/Amsterdam op een
 * specifieke kalenderdag-tijd. We bouwen de wandkloktijd-string die we
 * willen ("yyyy-mm-dd HH:MM"), interpreteren die eerst als UTC, dan
 * meten we het verschil tussen de NL-formattering van die UTC-Date en
 * de wandkloktijd. Dat verschil is precies de offset die we willen
 * aftrekken om de juiste UTC-Date te krijgen.
 */
function getNLOffsetMinutes(year: number, month: number, day: number, hour: number, minute: number): number {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: NL_TIMEZONE,
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
  const nlYear = get("year");
  const nlMonth = get("month");
  const nlDay = get("day");
  let nlHour = get("hour");
  // Intl returns "24" for midnight in some en-US output; normaliseer naar 0.
  if (nlHour === 24) nlHour = 0;
  const nlMinute = get("minute");

  // Build a "what NL clock said" timestamp as if it were UTC, vs the
  // input wall-clock as if UTC. Difference = NL offset.
  const nlAsUtcMs = Date.UTC(nlYear, nlMonth - 1, nlDay, nlHour, nlMinute);
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  return Math.round((nlAsUtcMs - wallAsUtcMs) / 60000);
}

/**
 * Combineer een kalenderdatum (year/month/day in NL-tijd) + HH:MM tot
 * een echte UTC-Date die op die NL-wandkloktijd valt. DST-correct.
 */
export function combineDateAndTimeNL(calendarDate: Date, hhmm: string): Date {
  const [hourStr, minuteStr] = hhmm.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  // We willen calendarDate's year/month/day interpreteren in NL-tijd.
  // Het simpelst: gebruik UTC-getters van de calendarDate (de form
  // levert een ISO-string van bijv. "2026-05-09T00:00:00.000Z" voor
  // "9 mei in NL-bril"). Dat impliceert dat de calendar-date al in NL-
  // tijd-bedoeling is opgeslagen, en de UTC-getters geven ons de
  // beoogde year/month/day.
  const year = calendarDate.getUTCFullYear();
  const month = calendarDate.getUTCMonth() + 1;
  const day = calendarDate.getUTCDate();

  const offsetMin = getNLOffsetMinutes(year, month, day, hour, minute);
  // Wall-time geinterpreteerd als UTC, min de offset = werkelijke UTC.
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMin * 60000;
  return new Date(utcMs);
}

export interface AuctionWindowInput {
  startDate: Date; // calendar-day in NL-tijd (form leverde "yyyy-mm-dd")
  duration: number; // 3 | 5 | 7 | 14
  endTimeOfDay: string; // "HH:MM"
}

export interface AuctionWindow {
  startTime: Date;
  endTime: Date;
}

/**
 * Bereken start/end-time uit form-inputs.
 * - endTime = (startDate + duration days) @ endTimeOfDay (NL-tijd)
 * - startTime = endTime − duration days
 *
 * Symmetrisch: seller stelt eindtijd in op de eind-dag, en de veiling
 * start een gelijk uur op de start-dag — wat sellers wat houvast geeft
 * ("mijn veiling start om 20:30 en eindigt om 20:30, N dagen later").
 */
export function deriveAuctionWindow(input: AuctionWindowInput): AuctionWindow {
  const endCalendarDate = new Date(input.startDate);
  endCalendarDate.setUTCDate(endCalendarDate.getUTCDate() + input.duration);

  const endTime = combineDateAndTimeNL(endCalendarDate, input.endTimeOfDay);
  const startTime = new Date(endTime.getTime() - input.duration * 24 * 60 * 60 * 1000);
  return { startTime, endTime };
}

/**
 * Format een Date als NL-locale-string voor preview/banner.
 * Voorbeeld: "donderdag 14 mei om 20:30".
 */
export function formatNLDateTime(date: Date, locale: string = "nl-NL"): string {
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: NL_TIMEZONE, weekday: "long" }).format(date);
  const dayMonth = new Intl.DateTimeFormat(locale, { timeZone: NL_TIMEZONE, day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: NL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${weekday} ${dayMonth} om ${time}`;
}

/**
 * 19:00–21:00 = sweet-spot avond-snipe-window. Form-hint highlight't.
 */
export function isSweetSpot(hhmm: string): boolean {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const minutes = h * 60 + m;
  return minutes >= 19 * 60 && minutes <= 21 * 60;
}

/**
 * Drempel waaronder een "future" startTime alsnog als ACTIVE (live nu)
 * wordt geinterpreteerd. Houdt de status-machine eenvoudig: als de
 * seller binnen 5 min wilt starten, is het feitelijk een instant-publish.
 */
export const SCHEDULED_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Maximale dagen-vooruit dat een veiling gepland mag worden.
 */
export const MAX_SCHEDULE_DAYS_AHEAD = 5;
