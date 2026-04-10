-- CreateTable
CREATE TABLE "CosmeticBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "assetPath" TEXT,
    "rewardValue" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CosmeticItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CosmeticBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lootbox" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lootbox_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CosmeticBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LootboxItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lootboxId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    CONSTRAINT "LootboxItem_lootboxId_fkey" FOREIGN KEY ("lootboxId") REFERENCES "Lootbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LootboxItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "obtainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    CONSTRAINT "OwnedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LootboxOpening" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lootboxId" TEXT NOT NULL,
    "resultItemId" TEXT NOT NULL,
    "wasDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "recycledForXP" INTEGER,
    "recycledForEmber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LootboxOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LootboxOpening_lootboxId_fkey" FOREIGN KEY ("lootboxId") REFERENCES "Lootbox" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmberTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmberTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "embersAwarded" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "profileBanner" TEXT,
    "profileEmblem" TEXT,
    "profileBackground" TEXT,
    "emberBalance" INTEGER NOT NULL DEFAULT 0,
    "bonusXP" INTEGER NOT NULL DEFAULT 0,
    "balance" REAL NOT NULL DEFAULT 0,
    "heldBalance" REAL NOT NULL DEFAULT 0,
    "reservedBalance" REAL NOT NULL DEFAULT 0,
    "bankTransferReference" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "accountType" TEXT NOT NULL DEFAULT 'FREE',
    "premiumExpiresAt" DATETIME,
    "accountKind" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "vatNumber" TEXT,
    "cocNumber" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "sellingCountries" TEXT NOT NULL DEFAULT 'ALL_EU',
    "accountFocus" TEXT,
    "referralSource" TEXT,
    "termsAcceptedAt" DATETIME,
    "lastUsernameChange" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountFocus", "accountKind", "accountType", "avatarUrl", "balance", "bankTransferReference", "bio", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "firstName", "heldBalance", "houseNumber", "id", "isVerified", "lastName", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "profileBanner", "referralSource", "reservedBalance", "sellingCountries", "street", "termsAcceptedAt", "updatedAt", "vatNumber", "verificationStatus") SELECT "accountFocus", "accountKind", "accountType", "avatarUrl", "balance", "bankTransferReference", "bio", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "firstName", "heldBalance", "houseNumber", "id", "isVerified", "lastName", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "profileBanner", "referralSource", "reservedBalance", "sellingCountries", "street", "termsAcceptedAt", "updatedAt", "vatNumber", "verificationStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_bankTransferReference_key" ON "User"("bankTransferReference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticBundle_key_key" ON "CosmeticBundle"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItem_key_key" ON "CosmeticItem"("key");

-- CreateIndex
CREATE INDEX "CosmeticItem_bundleId_idx" ON "CosmeticItem"("bundleId");

-- CreateIndex
CREATE INDEX "CosmeticItem_type_idx" ON "CosmeticItem"("type");

-- CreateIndex
CREATE INDEX "CosmeticItem_rarity_idx" ON "CosmeticItem"("rarity");

-- CreateIndex
CREATE UNIQUE INDEX "Lootbox_key_key" ON "Lootbox"("key");

-- CreateIndex
CREATE INDEX "Lootbox_bundleId_idx" ON "Lootbox"("bundleId");

-- CreateIndex
CREATE INDEX "LootboxItem_lootboxId_idx" ON "LootboxItem"("lootboxId");

-- CreateIndex
CREATE UNIQUE INDEX "LootboxItem_lootboxId_itemId_key" ON "LootboxItem"("lootboxId", "itemId");

-- CreateIndex
CREATE INDEX "OwnedItem_userId_idx" ON "OwnedItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedItem_userId_itemId_key" ON "OwnedItem"("userId", "itemId");

-- CreateIndex
CREATE INDEX "LootboxOpening_userId_idx" ON "LootboxOpening"("userId");

-- CreateIndex
CREATE INDEX "LootboxOpening_lootboxId_idx" ON "LootboxOpening"("lootboxId");

-- CreateIndex
CREATE INDEX "EmberTransaction_userId_idx" ON "EmberTransaction"("userId");

-- CreateIndex
CREATE INDEX "EmberTransaction_createdAt_idx" ON "EmberTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_action_createdAt_idx" ON "ActivityLog"("userId", "action", "createdAt");
