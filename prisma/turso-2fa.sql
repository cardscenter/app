-- Fase 16-followup — 2FA (TOTP). Additieve migratie voor Turso (libSQL).
-- Toepassen via: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-2fa.sql
-- LET OP: bewust ALTER ADD COLUMN i.p.v. table-rebuild.

ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpBackupCodes" TEXT;
