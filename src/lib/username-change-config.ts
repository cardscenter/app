/**
 * Regels rond het wijzigen van de gebruikersnaam en de volledige naam.
 *
 * Bewust een apart bestand (géén `"use server"`): client-componenten moeten
 * deze constanten en helpers kunnen importeren voor de UI-staat.
 *
 * Beleid (sept 2026):
 * - De gebruikersnaam mag **precies één keer** door de gebruiker zelf worden
 *   gewijzigd, tegen betaling van {@link USERNAME_CHANGE_FEE} uit het saldo.
 *   Daarna staat de naam permanent vast; alleen support kan hem nog wijzigen
 *   (na controle van een geldig identiteitsbewijs).
 * - Elke wijziging — ook die door support — schrijft een `UsernameHistory`-rij,
 *   die publiek zichtbaar is op het profiel. Een naam kan dus nooit stilletjes
 *   verdwijnen; kopers kunnen altijd zien onder welke namen iemand handelde.
 * - De volledige naam (voor-/achternaam) is eenmalig invulbaar en daarna
 *   read-only, om dezelfde reden.
 */

/** Kosten van de eenmalige zelf-wijziging, in euro, van het saldo. */
export const USERNAME_CHANGE_FEE = 2.99;

/** Transaction.type voor de afschrijving (geen enum in het schema). */
export const USERNAME_CHANGE_TX_TYPE = "USERNAME_CHANGE";

export type UsernameChangeState = {
  /** Mag de gebruiker zichzelf (nog) hernoemen? */
  canChange: boolean;
  /** Wat het kost als het mag. */
  fee: number;
  /** Wanneer de eenmalige wijziging is verbruikt (null = nog beschikbaar). */
  usedAt: Date | null;
};

/**
 * Bepaalt of de gebruiker z'n eenmalige naamswijziging nog heeft staan.
 * `lastUsernameChange` fungeert als "verbruikt"-vlag: gevuld = op slot.
 */
export function getUsernameChangeState(
  lastUsernameChange: Date | string | null | undefined,
): UsernameChangeState {
  const usedAt = lastUsernameChange ? new Date(lastUsernameChange) : null;
  return {
    canChange: usedAt === null,
    fee: USERNAME_CHANGE_FEE,
    usedAt,
  };
}

/**
 * Is een ingetypte naam alleen een andere schrijfwijze van de huidige naam?
 * Zo'n wissel ("youri" → "Youri") is dezelfde handle en blijft daarom gratis:
 * hij verbruikt de eenmalige wijziging niet en komt niet in de historie.
 */
export function isCaseOnlyRename(current: string, next: string): boolean {
  return (
    current !== next && current.toLowerCase() === next.trim().toLowerCase()
  );
}
