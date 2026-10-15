-- Community Hub, Fase 2 (accounts & profielen). Additief: alleen ADD COLUMN
-- en CREATE TABLE. Toepassen op Turso met:
--   npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-hub-fase2.sql
-- (vóór de deploy van de Fase 2-code).

ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'PLAYER';
ALTER TABLE "User" ADD COLUMN "dateOfBirth" DATETIME;
ALTER TABLE "User" ADD COLUMN "favoriteGames" TEXT;
ALTER TABLE "User" ADD COLUMN "playerIds" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianName" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianConsentAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "showOnParticipantLists" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "showOnLeaderboards" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "newsletterOptInAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;

CREATE TABLE IF NOT EXISTS "MagicLinkToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MagicLinkToken_tokenHash_key" ON "MagicLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "MagicLinkToken_email_idx" ON "MagicLinkToken"("email");

CREATE TABLE IF NOT EXISTS "GuardianConsentToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guardianEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianConsentToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuardianConsentToken_token_key" ON "GuardianConsentToken"("token");
CREATE INDEX IF NOT EXISTS "GuardianConsentToken_userId_idx" ON "GuardianConsentToken"("userId");

CREATE TABLE IF NOT EXISTS "GameOption" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "playerIdLabel" TEXT
);
