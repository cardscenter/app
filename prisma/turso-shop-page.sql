-- Fase 45 — winkelpagina (custom seller profile). Additieve migratie voor Turso (libSQL).
-- Toepassen via: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-shop-page.sql
-- LET OP: bewust ALTER ADD COLUMN i.p.v. table-rebuild.

ALTER TABLE "User" ADD COLUMN "shopBannerUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "shopTagline" TEXT;
ALTER TABLE "User" ADD COLUMN "shopBlocks" TEXT;
ALTER TABLE "User" ADD COLUMN "shopPublished" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "shopUpdatedAt" DATETIME;
