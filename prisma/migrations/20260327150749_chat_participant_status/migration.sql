-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastReadAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" DATETIME,
    "deletedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ConversationParticipant" ("conversationId", "id", "lastReadAt", "userId") SELECT "conversationId", "id", "lastReadAt", "userId" FROM "ConversationParticipant";
DROP TABLE "ConversationParticipant";
ALTER TABLE "new_ConversationParticipant" RENAME TO "ConversationParticipant";
CREATE UNIQUE INDEX "ConversationParticipant_userId_conversationId_key" ON "ConversationParticipant"("userId", "conversationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
