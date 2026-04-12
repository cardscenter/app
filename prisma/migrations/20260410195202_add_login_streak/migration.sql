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
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoginDate" TEXT,
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
INSERT INTO "new_User" ("accountFocus", "accountKind", "accountType", "avatarUrl", "balance", "bankTransferReference", "bio", "bonusXP", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "emberBalance", "firstName", "heldBalance", "houseNumber", "id", "isVerified", "lastName", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "profileBackground", "profileBanner", "profileEmblem", "referralSource", "reservedBalance", "sellingCountries", "street", "termsAcceptedAt", "updatedAt", "vatNumber", "verificationStatus") SELECT "accountFocus", "accountKind", "accountType", "avatarUrl", "balance", "bankTransferReference", "bio", "bonusXP", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "emberBalance", "firstName", "heldBalance", "houseNumber", "id", "isVerified", "lastName", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "profileBackground", "profileBanner", "profileEmblem", "referralSource", "reservedBalance", "sellingCountries", "street", "termsAcceptedAt", "updatedAt", "vatNumber", "verificationStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_bankTransferReference_key" ON "User"("bankTransferReference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
