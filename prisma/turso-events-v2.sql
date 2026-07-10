-- Events v2: flyer + vroege toegang (2026-07-10)
-- Additief only — NOOIT een table-rebuild op de productie-Event-tabel.
-- Toepassen op Turso via een @libsql/client.executeMultiple-script (zoals scripts/push-to-turso.ts).
ALTER TABLE "Event" ADD COLUMN "flyerImage" TEXT;
ALTER TABLE "Event" ADD COLUMN "earlyAccessTime" DATETIME;
ALTER TABLE "Event" ADD COLUMN "venueSizeM2" INTEGER;
ALTER TABLE "Event" ADD COLUMN "socialLinks" TEXT;
