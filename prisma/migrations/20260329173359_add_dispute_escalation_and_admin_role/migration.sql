-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingBundleId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" TEXT NOT NULL DEFAULT '[]',
    "sellerResponse" TEXT,
    "sellerEvidenceUrls" TEXT,
    "sellerRespondedAt" DATETIME,
    "partialRefundAmount" REAL,
    "proposedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "buyerAcceptsEscalation" BOOLEAN NOT NULL DEFAULT false,
    "sellerAcceptsEscalation" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "responseDeadline" DATETIME NOT NULL,
    "buyerReviewDeadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Dispute" ("buyerReviewDeadline", "createdAt", "description", "evidenceUrls", "id", "openedById", "partialRefundAmount", "reason", "resolution", "resolvedAt", "responseDeadline", "sellerEvidenceUrls", "sellerRespondedAt", "sellerResponse", "shippingBundleId", "status", "updatedAt") SELECT "buyerReviewDeadline", "createdAt", "description", "evidenceUrls", "id", "openedById", "partialRefundAmount", "reason", "resolution", "resolvedAt", "responseDeadline", "sellerEvidenceUrls", "sellerRespondedAt", "sellerResponse", "shippingBundleId", "status", "updatedAt" FROM "Dispute";
DROP TABLE "Dispute";
ALTER TABLE "new_Dispute" RENAME TO "Dispute";
CREATE UNIQUE INDEX "Dispute_shippingBundleId_key" ON "Dispute"("shippingBundleId");
CREATE INDEX "Dispute_openedById_idx" ON "Dispute"("openedById");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
