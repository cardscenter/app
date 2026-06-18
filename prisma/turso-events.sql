-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "publishedAt" DATETIME,
    "venueName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "timezone" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'FREE',
    "entryPriceMode" TEXT NOT NULL DEFAULT 'SINGLE',
    "entryPrice" REAL,
    "entryCurrency" TEXT,
    "ticketTypes" TEXT,
    "childrenFreeUntilAge" INTEGER,
    "vendorOptions" TEXT,
    "vendorInfo" TEXT,
    "canPlay" BOOLEAN NOT NULL DEFAULT false,
    "canTrade" BOOLEAN NOT NULL DEFAULT false,
    "canSell" BOOLEAN NOT NULL DEFAULT false,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "hasFood" BOOLEAN NOT NULL DEFAULT false,
    "hasToilets" BOOLEAN NOT NULL DEFAULT false,
    "hasWifi" BOOLEAN NOT NULL DEFAULT false,
    "cardPayment" BOOLEAN NOT NULL DEFAULT false,
    "wheelchairAccessible" BOOLEAN NOT NULL DEFAULT false,
    "hasCloakroom" BOOLEAN NOT NULL DEFAULT false,
    "childFriendly" BOOLEAN NOT NULL DEFAULT false,
    "maxVisitors" INTEGER,
    "totalTables" INTEGER,
    "registrationUrl" TEXT,
    "coverImage" TEXT,
    "galleryImages" TEXT,
    "videoUrl" TEXT,
    "organizerName" TEXT,
    "organizerWebsite" TEXT,
    "tournamentFormat" TEXT,
    "isSanctioned" BOOLEAN NOT NULL DEFAULT false,
    "prizePool" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventUpsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "dailyCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventUpsell_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventReport_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable: alleen de nieuwe kolom toevoegen (GEEN table-rebuild op productie)
ALTER TABLE "User" ADD COLUMN "isTrustedEventOrganizer" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Event_status_startTime_idx" ON "Event"("status", "startTime");

-- CreateIndex
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");

-- CreateIndex
CREATE INDEX "Event_country_idx" ON "Event"("country");

-- CreateIndex
CREATE INDEX "EventUpsell_eventId_idx" ON "EventUpsell"("eventId");

-- CreateIndex
CREATE INDEX "EventUpsell_type_expiresAt_idx" ON "EventUpsell"("type", "expiresAt");

-- CreateIndex
CREATE INDEX "EventReport_reporterId_idx" ON "EventReport"("reporterId");

-- CreateIndex
CREATE INDEX "EventReport_eventId_idx" ON "EventReport"("eventId");

-- CreateIndex
CREATE INDEX "EventReport_status_idx" ON "EventReport"("status");
