-- Fase 45 — zoekboost-denormalisatie. Additieve migratie voor Turso (libSQL).
-- Toepassen via: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-search-boost.sql
-- LET OP: bewust ALTER ADD COLUMN i.p.v. table-rebuild.

ALTER TABLE "User" ADD COLUMN "searchBoost" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "searchBoost" = true WHERE "accountType" IN ('UNLIMITED', 'ENTERPRISE', 'ADMIN');
UPDATE "User" SET "tierRank" = CASE "accountType"
  WHEN 'PRO' THEN 2
  WHEN 'UNLIMITED' THEN 3
  WHEN 'ENTERPRISE' THEN 4
  WHEN 'ADMIN' THEN 4
  ELSE 1 END;
