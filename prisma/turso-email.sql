-- Fase 16 — E-mailnotificaties. Additieve migratie voor Turso (libSQL).
-- Toepassen via: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-email.sql
-- LET OP: bewust ALTER ADD COLUMN i.p.v. table-rebuild (zie events-Turso-les in CLAUDE.md).

ALTER TABLE "User" ADD COLUMN "emailPreferences" TEXT;

CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "subject" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EmailLog_userId_type_sentAt_idx" ON "EmailLog"("userId", "type", "sentAt");
CREATE INDEX IF NOT EXISTS "EmailLog_dedupeKey_sentAt_idx" ON "EmailLog"("dedupeKey", "sentAt");
