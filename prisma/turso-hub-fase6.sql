-- Community Hub, Fase 6: bulk-inkoop alleen naar bankrekening, retour via Mollie,
-- beheerbare inkooptarieven. Additief; toepassen met:
--   npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-hub-fase6.sql
-- Daarna: npx tsx scripts/encrypt-ibans.ts "libsql://<db>.turso.io" --apply
-- (versleutelt bestaande IBANs; vereist IBAN_ENCRYPTION_KEY, ook op Railway).

-- AlterTable
ALTER TABLE "BuybackRequest" ADD COLUMN "userDecision" TEXT;
ALTER TABLE "BuybackRequest" ADD COLUMN "userDecidedAt" DATETIME;
ALTER TABLE "BuybackRequest" ADD COLUMN "decisionDeadline" DATETIME;
ALTER TABLE "BuybackRequest" ADD COLUMN "returnPaymentId" TEXT;
ALTER TABLE "BuybackRequest" ADD COLUMN "returnCarrier" TEXT;
ALTER TABLE "BuybackRequest" ADD COLUMN "returnTrackingNumber" TEXT;
ALTER TABLE "BuybackRequest" ADD COLUMN "returnedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "BuybackRequest_returnPaymentId_key" ON "BuybackRequest"("returnPaymentId");

-- CreateTable
CREATE TABLE "BulkPriceCategory" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "group" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weightGrams" REAL NOT NULL DEFAULT 1.8,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
