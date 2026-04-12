-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lootbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "emberCost" INTEGER NOT NULL,
    "bundleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weightUncommon" INTEGER NOT NULL DEFAULT 5000,
    "weightRare" INTEGER NOT NULL DEFAULT 3000,
    "weightEpic" INTEGER NOT NULL DEFAULT 1500,
    "weightLegendary" INTEGER NOT NULL DEFAULT 450,
    "weightUnique" INTEGER NOT NULL DEFAULT 50,
    "weightShiny" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lootbox_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CosmeticBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lootbox" ("bundleId", "createdAt", "description", "emberCost", "id", "imageUrl", "isActive", "key", "name", "weightEpic", "weightLegendary", "weightRare", "weightUncommon", "weightUnique") SELECT "bundleId", "createdAt", "description", "emberCost", "id", "imageUrl", "isActive", "key", "name", "weightEpic", "weightLegendary", "weightRare", "weightUncommon", "weightUnique" FROM "Lootbox";
DROP TABLE "Lootbox";
ALTER TABLE "new_Lootbox" RENAME TO "Lootbox";
CREATE UNIQUE INDEX "Lootbox_key_key" ON "Lootbox"("key");
CREATE INDEX "Lootbox_bundleId_idx" ON "Lootbox"("bundleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
