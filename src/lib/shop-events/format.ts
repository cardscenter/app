/**
 * Datum-/tijdweergave voor winkel-events (puur). De winkel staat in Hulst,
 * dus alles in Europe/Amsterdam, ongeacht de browser-tijdzone.
 */
export const SHOP_TIMEZONE = "Europe/Amsterdam";

function intlLocale(locale: string | undefined): string {
  return locale === "en" ? "en-GB" : "nl-NL";
}

/** "zaterdag 14 maart 2027" */
export function formatEventDate(d: Date, locale = "nl"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: SHOP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** "za 14 mrt" */
export function formatEventDateShort(d: Date, locale = "nl"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: SHOP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** "19:00" */
export function formatEventTime(d: Date, locale = "nl"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: SHOP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** "zaterdag 14 maart 2027, 19:00 tot 22:30" */
export function formatEventDateTimeRange(start: Date, end: Date, locale = "nl"): string {
  const sep = locale === "en" ? " to " : " tot ";
  return `${formatEventDate(start, locale)}, ${formatEventTime(start, locale)}${sep}${formatEventTime(end, locale)}`;
}

/** "maart 2027" (groepskop in de lijst) */
export function formatMonthHeading(d: Date, locale = "nl"): string {
  const s = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: SHOP_TIMEZONE, month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Maand-sleutel "2027-03" in winkel-tijd (voor groeperen/kalender). */
export function monthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/** Dag-sleutel "2027-03-14" in winkel-tijd. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Wandklok in de winkel ("2027-03-14" + "19:00") → UTC-Date. DST-correct via
 * Intl: we bepalen de offset van Europe/Amsterdam op dat moment.
 */
export function shopWallClockToUtc(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!m || !t) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  // Round-trip-check vangt 31 februari e.d.
  if (new Date(Date.UTC(y, mo - 1, d)).getUTCDate() !== d) return null;
  // Eerste gok: alsof het UTC is; daarna corrigeren met de werkelijke offset.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset1 = tzOffsetMinutes(new Date(guess));
  let utc = guess - offset1 * 60_000;
  // Rond DST-wissel kan de offset na correctie verschillen; één keer herhalen.
  const offset2 = tzOffsetMinutes(new Date(utc));
  if (offset2 !== offset1) utc = guess - offset2 * 60_000;
  const out = new Date(utc);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** UTC-Date → { date: "YYYY-MM-DD", time: "HH:MM" } in winkel-tijd (voor formulieren). */
export function utcToShopWallClock(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

/** Offset van Europe/Amsterdam t.o.v. UTC in minuten op moment `d`. */
function tzOffsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60_000);
}

export function formatPrice(amount: number, locale = "nl"): string {
  if (!Number.isFinite(amount) || amount <= 0) return locale === "en" ? "Free" : "Gratis";
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR" }).format(amount);
}
