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
 * Vaste start-wandkloktijd voor geplande claimsales. Anders dan veilingen
 * (waar de seller een eindtijd kiest) heeft een claimsale geen tijd-van-dag-
 * keuze nodig — een vaste ochtenduur houdt de UI simpel: één date-picker.
 */
export const CLAIMSALE_START_HOUR = "09:00";

/**
 * Zet de gekozen kalenderdatum om naar een echte UTC-Date op CLAIMSALE_START_HOUR
 * NL-tijd. Vandaag gekozen → 09:00 vandaag (kan in het verleden liggen →
 * instant LIVE). Toekomstige datum → SCHEDULED.
 */
export function deriveClaimsaleStartTime(startDate: Date): Date {
  return combineDateAndTimeNL(startDate, CLAIMSALE_START_HOUR);
}

/**
 * Een startTime telt als "gepland" wanneer 'ie meer dan SCHEDULED_THRESHOLD_MS
 * in de toekomst ligt. Daaronder is het feitelijk een instant-publish.
 */
export function isClaimsaleScheduled(startTime: Date): boolean {
  return startTime.getTime() > Date.now() + SCHEDULED_THRESHOLD_MS;
}
