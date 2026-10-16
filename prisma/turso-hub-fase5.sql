-- AlterTable
ALTER TABLE "User" ADD COLUMN "internalNote" TEXT;

-- CreateTable
CREATE TABLE "LeagueSeason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "game" TEXT,
    "description" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pointsWin" INTEGER NOT NULL DEFAULT 3,
    "pointsDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsLoss" INTEGER NOT NULL DEFAULT 0,
    "pointsParticipation" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeagueResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "eventId" TEXT,
    "userId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeagueResult_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeagueResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ShopEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeagueResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT 'amber',
    "criterion" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserLeagueBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "seasonId" TEXT,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLeagueBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLeagueBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "LeagueBadge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLeagueBadge_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventId" TEXT,
    "staffId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "authorId" TEXT NOT NULL,
    "newsletterSentAt" DATETIME,
    "newsletterRecipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LeagueSeason_status_startsAt_idx" ON "LeagueSeason"("status", "startsAt");

-- CreateIndex
CREATE INDEX "LeagueResult_seasonId_userId_idx" ON "LeagueResult"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "LeagueResult_userId_idx" ON "LeagueResult"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueResult_seasonId_eventId_userId_key" ON "LeagueResult"("seasonId", "eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueBadge_key_key" ON "LeagueBadge"("key");

-- CreateIndex
CREATE INDEX "UserLeagueBadge_userId_idx" ON "UserLeagueBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLeagueBadge_userId_badgeId_seasonId_key" ON "UserLeagueBadge"("userId", "badgeId", "seasonId");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_userId_kind_idx" ON "LoyaltyEntry"("userId", "kind");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_createdAt_idx" ON "LoyaltyEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");

-- CreateIndex
CREATE INDEX "NewsPost_status_pinned_publishedAt_idx" ON "NewsPost"("status", "pinned", "publishedAt");

