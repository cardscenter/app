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

/**
 * Parse een `<input type="datetime-local">`-waarde ("yyyy-MM-ddTHH:mm") als
 * NL-wandkloktijd → UTC Date. DST-correct via dezelfde offset-helper als
 * `combineDateAndTimeNL`.
 */
export function parseNLDateTimeLocal(value: string): Date {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return new Date(NaN);
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return new Date(NaN);
  const offsetMin = getNLOffsetMinutes(year, month, day, hour, minute);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMin * 60000;
  return new Date(utcMs);
}

/**
 * Format Date → "yyyy-MM-ddTHH:mm" in NL-wandkloktijd voor gebruik als
 * `value` van een `<input type="datetime-local">`.
 */
export function formatNLDateTimeLocal(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: NL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // en-CA produceert "2026-05-17, 20:00" — we willen "2026-05-17T20:00".
  return fmt.format(date).replace(", ", "T");
}

/**
 * Maximale veiling-lengte (start → eind). 15 dagen = strikte bovengrens
 * (exclusive): 14 dagen en X uren mag, exact 15 dagen niet. Hiermee kan een
 * seller die 's nachts om 01:00 start z'n veiling laten eindigen op 14 dagen
 * later om 23:00 (= 14d 22u) zonder dat de cap "afsnijdt".
 */
export const MAX_AUCTION_DURATION_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * Minimum veiling-lengte. 1 uur = ondergrens — voorkomt
 * spam-flash-veilingen die direct via anti-snipe verlengen.
 */
export const MIN_AUCTION_DURATION_MS = 60 * 60 * 1000;

/**
 * Bereken een legacy `duration`-waarde (in dagen) uit start/end-time. Wordt
 * gebruikt om de bestaande `Auction.duration`-kolom te vullen — geen
 * runtime-gevolgen, alleen voor filter-sidebar (3/5/7/14-dagen-buckets).
 */
export function deriveDurationDays(startTime: Date, endTime: Date): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  return Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
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
 * Drempel waaronder een "future" startTime alsnog als ACTIVE (live nu)
 * wordt geinterpreteerd. Houdt de status-machine eenvoudig: als de
 * seller binnen 5 min wilt starten, is het feitelijk een instant-publish.
 */
export const SCHEDULED_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Maximale dagen-vooruit dat een veiling gepland mag worden. 7 = volledige
 * komende week zodat seller op elke gewenste weekdag kan eindigen.
 */
export const MAX_SCHEDULE_DAYS_AHEAD = 7;

/**
 * Kwaliteits-rating voor het eindmoment van een veiling. Op basis van
 * weekdag + uur in NL-tijd. Doel: seller voorkomt onhandige eindtijden
 * (3 uur 's nachts woensdag) en wordt gestuurd naar de piek (vrij/zat 19-21u).
 */
export type EndTimeRatingScore = 1 | 2 | 3 | 4 | 5;

export interface EndTimeRating {
  score: EndTimeRatingScore;
  label: string;
  tone: "emerald" | "sky" | "slate" | "amber" | "rose";
  /** Suggestie. `null` = perfect, geen advies nodig. */
  recommendation: string | null;
}

export function rateAuctionEndTime(endTime: Date): EndTimeRating {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: NL_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(endTime);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;

  const isFri = weekdayShort === "Fri";
  const isSat = weekdayShort === "Sat";
  const isSun = weekdayShort === "Sun";
  const isWeekendNight = isFri || isSat;
  const isWeekday = !isFri && !isSat && !isSun;

  // Piek-vensters per weekdag-type. Vrij/zat is breedst (uitgaansavond),
  // zondag korter (vroeg naar bed voor maandag), door-de-weeks smalst.
  const peakStart = 19 * 60;
  const peakEnd = isWeekendNight ? 23 * 60 : isSun ? 22 * 60 : 21 * 60 + 30;

  // Vijf tijd-buckets — peak + pre-peak + post-peak (late avond) +
  // deep-night + daytime. Late-avond is bewust apart van deep-night zodat
  // 23:30 op vrijdag een milde melding krijgt ipv hard "kopers slapen".
  const inPeak = totalMinutes >= peakStart && totalMinutes <= peakEnd;
  const inPrePeak = totalMinutes >= 17 * 60 && totalMinutes < peakStart;
  const inLateEvening = totalMinutes > peakEnd && totalMinutes <= 23 * 60 + 59;
  const inDeepNight = totalMinutes < 7 * 60;
  const inDaytime = totalMinutes >= 7 * 60 && totalMinutes < 17 * 60;

  // Score 5 — vrij/zat in piek
  if (isWeekendNight && inPeak) {
    return { score: 5, label: "Fantastische keuze", tone: "emerald", recommendation: null };
  }

  // Score 4 — zondag in piek of vrij/zat pre-piek
  if (isSun && inPeak) {
    return {
      score: 4,
      label: "Goede keuze",
      tone: "sky",
      recommendation: "Vrijdag- of zaterdagavond tussen 19:00 en 23:00 levert vaak nog iets meer biedingen op.",
    };
  }
  if (isWeekendNight && inPrePeak) {
    return {
      score: 4,
      label: "Goede keuze",
      tone: "sky",
      recommendation: "Tussen 19:00 en 23:00 zit de piek — overweeg je eindtijd binnen dat venster te leggen.",
    };
  }

  // Score 3 — doordeweekse piek of zondag pre-piek
  if (isWeekday && inPeak) {
    return {
      score: 3,
      label: "Redelijke keuze",
      tone: "slate",
      recommendation:
        "Doordeweeks krijg je minder biedingen dan in het weekend — vrijdag- of zaterdagavond tussen 19:00 en 23:00 is de piek.",
    };
  }
  if (isSun && inPrePeak) {
    return {
      score: 3,
      label: "Redelijke keuze",
      tone: "slate",
      recommendation: "Tussen 19:00 en 22:00 zit de piek voor zondagavond.",
    };
  }

  // Score 2 — late-avond shoulder per weekdag-type, plus weekend overdag
  // en doordeweekse pre-piek. Allemaal "niet ideaal" amber, niet rood.
  if (isWeekendNight && inLateEvening) {
    return {
      score: 2,
      label: "Aan de late kant",
      tone: "amber",
      recommendation: "Iets later dan ideaal. Tussen 19:00 en 23:00 op vrijdag of zaterdag zit de echte piek.",
    };
  }
  if (isSun && inLateEvening) {
    return {
      score: 2,
      label: "Aan de late kant",
      tone: "amber",
      recommendation: "Iets later dan ideaal voor zondagavond. Tussen 19:00 en 22:00 zit de piek; vrijdag- of zaterdagavond is nog actiever.",
    };
  }
  if (isWeekday && (inPrePeak || inLateEvening)) {
    return {
      score: 2,
      label: "Niet ideaal",
      tone: "amber",
      recommendation: "Doordeweekse avonden trekken minder biedingen dan vrijdag- of zaterdagavond tussen 19:00 en 23:00.",
    };
  }
  if (isWeekendNight && inDaytime) {
    return {
      score: 2,
      label: "Niet ideaal",
      tone: "amber",
      recommendation: "Verleg je eindtijd naar de avond (rond 19:00-23:00) — daar zit het grootste deel van de biedingen.",
    };
  }
  if (isSun && inDaytime) {
    return {
      score: 2,
      label: "Niet ideaal",
      tone: "amber",
      recommendation: "Verleg je eindtijd naar de avond (rond 19:00-22:00) — daar zit het grootste deel van de biedingen.",
    };
  }

  // Score 1 — diepe nacht (00:00-06:59)
  if (inDeepNight) {
    return {
      score: 1,
      label: "Geen handige eindtijd",
      tone: "rose",
      recommendation:
        "Op dit tijdstip zijn er nauwelijks gebruikers actief op het platform. Een eindtijd tussen 19:00 en 23:00 — het liefst op vrijdag of zaterdag — trekt veel meer biedingen.",
    };
  }

  // Score 1 — doordeweeks overdag (07:00-16:59)
  return {
    score: 1,
    label: "Geen handige eindtijd",
    tone: "rose",
    recommendation:
      "Overdag zijn de meeste kopers minder actief op het platform. Een eindtijd 's avonds — het liefst vrijdag of zaterdag tussen 19:00 en 23:00 — trekt veel meer biedingen.",
  };
}
