-- Track which tier's celebration the user has already seen.
ALTER TABLE "UserAchievement" ADD COLUMN "acknowledgedTier" INTEGER NOT NULL DEFAULT 0;
