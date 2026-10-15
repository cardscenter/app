-- CreateTable
CREATE TABLE "MenuCategory" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "descriptionEn" TEXT,
    "price" REAL NOT NULL,
    "flow" TEXT,
    "veg" BOOLEAN NOT NULL DEFAULT false,
    "spice" INTEGER,
    "tag" TEXT,
    "tagEn" TEXT,
    "image" TEXT,
    "art" TEXT NOT NULL DEFAULT 'burger',
    "color" TEXT,
    "allergens" TEXT NOT NULL DEFAULT '[]',
    "ingredients" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "soldOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_categoryKey_fkey" FOREIGN KEY ("categoryKey") REFERENCES "MenuCategory" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FoodOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayKey" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "tableNumber" INTEGER,
    "name" TEXT,
    "userId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'nl',
    "lines" TEXT NOT NULL,
    "note" TEXT,
    "subtotal" REAL NOT NULL,
    "savings" REAL NOT NULL DEFAULT 0,
    "code" TEXT,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "tip" REAL NOT NULL DEFAULT 0,
    "payment" TEXT NOT NULL,
    "method" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "waitMinutes" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "startedAt" DATETIME,
    "readyAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FoodOrder_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MenuItem_categoryKey_sortOrder_idx" ON "MenuItem"("categoryKey", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_paymentId_key" ON "FoodOrder"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_accessToken_key" ON "FoodOrder"("accessToken");

-- CreateIndex
CREATE INDEX "FoodOrder_status_createdAt_idx" ON "FoodOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FoodOrder_dayKey_createdAt_idx" ON "FoodOrder"("dayKey", "createdAt");

-- CreateIndex
CREATE INDEX "FoodOrder_userId_idx" ON "FoodOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_dayKey_number_key" ON "FoodOrder"("dayKey", "number");

