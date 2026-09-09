-- Naambeleid (sept 2026): de volledige naam is eenmalig invulbaar en daarna
-- read-only; alleen support kan hem nog wijzigen na een geldig ID-bewijs.
-- `lastUsernameChange` bestond al en fungeert nu als "eenmalige betaalde
-- gebruikersnaamswijziging verbruikt"-vlag — daar is geen migratie voor nodig.
-- Additief — toepassen via: npx tsx scripts/push-to-turso.ts "<url>" prisma/turso-name-lock.sql
ALTER TABLE "User" ADD COLUMN "fullNameLockedAt" DATETIME;

-- Bestaande accounts met een ingevulde naam meteen op slot zetten, zodat het
-- beleid vanaf dag 1 klopt in plaats van iedereen nog één gratis wijziging te geven.
UPDATE "User"
SET "fullNameLockedAt" = CURRENT_TIMESTAMP
WHERE "fullNameLockedAt" IS NULL
  AND (COALESCE(TRIM("firstName"), '') <> '' OR COALESCE(TRIM("lastName"), '') <> '');
