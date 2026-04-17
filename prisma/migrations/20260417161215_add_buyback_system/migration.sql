-- CreateTable
CREATE TABLE "BuybackRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COLLECTION',
    "payoutMethod" TEXT NOT NULL DEFAULT 'BANK',
    "iban" TEXT,
    "accountHolder" TEXT,
    "totalItems" INTEGER NOT NULL,
    "estimatedPayout" REAL NOT NULL,
    "storeCreditBonus" REAL,
    "finalPayout" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "inspectedById" TEXT,
    "receivedAt" DATETIME,
    "inspectedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuybackRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuybackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buybackRequestId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardLocalId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "marketPrice" REAL NOT NULL,
    "buybackPrice" REAL NOT NULL,
    "isReverse" BOOLEAN NOT NULL DEFAULT false,
    "inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuybackItem_buybackRequestId_fkey" FOREIGN KEY ("buybackRequestId") REFERENCES "BuybackRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BulkBuybackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buybackRequestId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "approvedQuantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BulkBuybackItem_buybackRequestId_fkey" FOREIGN KEY ("buybackRequestId") REFERENCES "BuybackRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BuybackRequest_userId_idx" ON "BuybackRequest"("userId");

-- CreateIndex
CREATE INDEX "BuybackRequest_status_idx" ON "BuybackRequest"("status");

-- CreateIndex
CREATE INDEX "BuybackRequest_type_idx" ON "BuybackRequest"("type");

-- CreateIndex
CREATE INDEX "BuybackRequest_createdAt_idx" ON "BuybackRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BuybackItem_buybackRequestId_idx" ON "BuybackItem"("buybackRequestId");

-- CreateIndex
CREATE INDEX "BulkBuybackItem_buybackRequestId_idx" ON "BulkBuybackItem"("buybackRequestId");
