-- AlterTable
ALTER TABLE "Auction" ADD COLUMN "paymentDeadline" DATETIME;
ALTER TABLE "Auction" ADD COLUMN "paymentStatus" TEXT;

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "frontImageUrl" TEXT NOT NULL,
    "backImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
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
    "lastUsernameChange" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountKind", "accountType", "avatarUrl", "balance", "bio", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "heldBalance", "houseNumber", "id", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "street", "updatedAt", "vatNumber") SELECT "accountKind", "accountType", "avatarUrl", "balance", "bio", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "heldBalance", "houseNumber", "id", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "street", "updatedAt", "vatNumber" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_bankTransferReference_key" ON "User"("bankTransferReference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");
