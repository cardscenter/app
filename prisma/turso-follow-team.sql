-- Profiel-redesign (sept 2026): volgen + bedrijfsteam. Additief.
-- Toepassen via: npx tsx scripts/push-to-turso.ts "<url>" prisma/turso-follow-team.sql
CREATE TABLE IF NOT EXISTS "UserFollow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "UserFollow_followerId_idx" ON "UserFollow"("followerId");
CREATE INDEX IF NOT EXISTS "UserFollow_followingId_idx" ON "UserFollow"("followingId");

CREATE TABLE IF NOT EXISTS "BusinessMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" DATETIME,
  CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");
CREATE INDEX IF NOT EXISTS "BusinessMember_userId_status_idx" ON "BusinessMember"("userId", "status");
CREATE INDEX IF NOT EXISTS "BusinessMember_businessId_status_idx" ON "BusinessMember"("businessId", "status");
