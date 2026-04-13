-- Drop previous (flat) achievement schema
DROP TABLE IF EXISTS "UserAchievement";
DROP TABLE IF EXISTS "Achievement";

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AchievementTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "achievementKey" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardEmber" INTEGER,
    "rewardXP" INTEGER,
    "rewardCosmeticKey" TEXT,
    CONSTRAINT "AchievementTier_achievementKey_fkey" FOREIGN KEY ("achievementKey") REFERENCES "Achievement" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "currentTier" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "lastUnlockedAt" DATETIME,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementKey_fkey" FOREIGN KEY ("achievementKey") REFERENCES "Achievement" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");
CREATE UNIQUE INDEX "AchievementTier_achievementKey_tier_key" ON "AchievementTier"("achievementKey", "tier");
CREATE INDEX "AchievementTier_achievementKey_idx" ON "AchievementTier"("achievementKey");
CREATE UNIQUE INDEX "UserAchievement_userId_achievementKey_key" ON "UserAchievement"("userId", "achievementKey");
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");
CREATE INDEX "UserAchievement_achievementKey_idx" ON "UserAchievement"("achievementKey");
