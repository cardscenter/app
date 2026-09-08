-- Geschillen-unificatie (2026-09-08): één geschil-systeem.
--
-- 1. Nieuwe kolom op DisputeV2: waar een refund uit betaald wordt
--    (ESCROW = bundle was SHIPPED bij openen, SELLER_BALANCE = post-levering-
--    geschil op een al COMPLETED-bundle). Additief, default ESCROW.
-- 2. Het oude v1-model (Dispute + DisputeEvent) is uit het schema verwijderd.
--    In de testfase zijn er geen rijen; op live eerst controleren met
--      SELECT COUNT(*) FROM "Dispute";
--    en pas droppen als dat 0 is (anders eerst handmatig afronden).
--
-- Toepassen: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-disputes-unify.sql

ALTER TABLE "DisputeV2" ADD COLUMN "fundingSource" TEXT NOT NULL DEFAULT 'ESCROW';

DROP TABLE IF EXISTS "DisputeEvent";
DROP TABLE IF EXISTS "Dispute";
