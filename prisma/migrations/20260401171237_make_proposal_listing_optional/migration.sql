-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT,
    "conversationId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentDeadline" DATETIME,
    "paymentStatus" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Proposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Proposal" ("amount", "conversationId", "createdAt", "id", "listingId", "paymentDeadline", "paymentStatus", "proposerId", "respondedAt", "status", "type", "updatedAt") SELECT "amount", "conversationId", "createdAt", "id", "listingId", "paymentDeadline", "paymentStatus", "proposerId", "respondedAt", "status", "type", "updatedAt" FROM "Proposal";
DROP TABLE "Proposal";
ALTER TABLE "new_Proposal" RENAME TO "Proposal";
CREATE INDEX "Proposal_listingId_idx" ON "Proposal"("listingId");
CREATE INDEX "Proposal_conversationId_idx" ON "Proposal"("conversationId");
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
