-- Spaarpunten als korting op eten (1 punt = 1 cent). Additief; toepassen met:
--   npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-loyalty-food.sql
-- Daarna in het admin panel (Hub-instellingen) controleren of er oude waarden voor
-- punten per check-in / bonuspunten volle kaart / beloning opgeslagen staan.

-- AlterTable
ALTER TABLE "FoodOrder" ADD COLUMN "pointsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FoodOrder" ADD COLUMN "pointsDiscount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "FoodOrder" ADD COLUMN "pointsRefundedAt" DATETIME;
ALTER TABLE "FoodOrder" ADD COLUMN "pointsAwardedAt" DATETIME;
ALTER TABLE "LoyaltyEntry" ADD COLUMN "foodOrderId" TEXT;

-- CreateIndex
CREATE INDEX "LoyaltyEntry_foodOrderId_idx" ON "LoyaltyEntry"("foodOrderId");
