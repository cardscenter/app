/**
 * Claimsale-timing helpers — claimsales hebben geen looptijd of eindtijd
 * (ze sluiten als alle items weg zijn of handmatig). Het enige tijdvenster
 * dat een seller kiest is de start: direct LIVE of gepland (max +5 dagen).
 *
 * Hergebruikt de DST-correcte NL-tijdzone-helpers uit `auction/timing.ts`
 * zodat de marketplace-conventie (vaste tijdzone Europe/Amsterdam) consistent
 * blijft.
 */

import {
  combineDateAndTimeNL,
  formatNLDateTime,
  SCHEDULED_THRESHOLD_MS,
  MAX_SCHEDULE_DAYS_AHEAD,
} from "@/lib/auction/timing";

export { combineDateAndTimeNL, formatNLDateTime, SCHEDULED_THRESHOLD_MS, MAX_SCHEDULE_DAYS_AHEAD };

/**
 * Default start-wandkloktijd wanneer de seller (nog) geen tijd koos.
 */
export const CLAIMSALE_DEFAULT_START_HOUR = "09:00";

/**
 * Zet de gekozen kalenderdatum + HH:MM-tijd om naar een echte UTC-Date in
 * NL-tijd. Tijd in het verleden → instant LIVE, toekomstige tijd → SCHEDULED.
 * `startTimeOfDay` leeg/ongeldig → terugval op CLAIMSALE_DEFAULT_START_HOUR.
 */
export function deriveClaimsaleStartTime(startDate: Date, startTimeOfDay?: string): Date {
  const hhmm =
    startTimeOfDay && /^\d{2}:\d{2}$/.test(startTimeOfDay)
      ? startTimeOfDay
      : CLAIMSALE_DEFAULT_START_HOUR;
  return combineDateAndTimeNL(startDate, hhmm);
}

/**
 * Een startTime telt als "gepland" wanneer 'ie meer dan SCHEDULED_THRESHOLD_MS
 * in de toekomst ligt. Daaronder is het feitelijk een instant-publish.
 */
export function isClaimsaleScheduled(startTime: Date): boolean {
  return startTime.getTime() > Date.now() + SCHEDULED_THRESHOLD_MS;
}
