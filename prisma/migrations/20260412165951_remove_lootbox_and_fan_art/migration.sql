-- Drop lootbox-related tables (pivot to achievement-based unlocks)
DROP TABLE IF EXISTS "LootboxOpening";
DROP TABLE IF EXISTS "LootboxItem";
DROP TABLE IF EXISTS "Lootbox";

-- Remove artistKey column from CosmeticItem (fan-art attribution no longer used)
ALTER TABLE "CosmeticItem" DROP COLUMN "artistKey";
