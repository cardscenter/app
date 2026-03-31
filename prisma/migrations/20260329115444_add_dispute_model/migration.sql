-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingBundleId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" TEXT NOT NULL DEFAULT '[]',
    "sellerResponse" TEXT,
    "sellerEvidenceUrls" TEXT,
    "sellerRespondedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "partialRefundAmount" REAL,
    "resolvedAt" DATETIME,
    "responseDeadline" DATETIME NOT NULL,
    "buyerReviewDeadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_shippingBundleId_key" ON "Dispute"("shippingBundleId");

-- CreateIndex
CREATE INDEX "Dispute_openedById_idx" ON "Dispute"("openedById");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
