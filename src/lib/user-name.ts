/**
 * Naamweergave (profiel-redesign sept 2026): Facebook-achtig — de volledige
 * naam is primair, de gebruikersnaam secundair als "@handle". Bedrijfs-
 * accounts tonen de bedrijfsnaam als titel. Client-importable, geen server-
 * imports.
 */

export type NameSource = {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  accountKind?: string | null;
  companyName?: string | null;
};

/** "Voornaam Achternaam", of de gebruikersnaam als die ontbreken (legacy). */
export function getFullName(u: NameSource): string {
  const full = [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean).join(" ");
  return full || u.displayName;
}

/** Titel van een profiel: bedrijfsnaam voor BUSINESS, anders de volledige naam. */
export function getProfileTitle(u: NameSource): string {
  if (u.accountKind === "BUSINESS" && u.companyName?.trim()) return u.companyName.trim();
  return getFullName(u);
}

/** "@gebruikersnaam" — de secundaire regel onder de titel. */
export function getHandle(u: Pick<NameSource, "displayName">): string {
  return `@${u.displayName}`;
}

/** Eerste letter voor avatar-fallbacks, altijd op basis van de getoonde naam. */
export function getInitial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}
