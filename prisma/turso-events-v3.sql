-- Events v3: RSVP + standhouder-aanvragen (2026-07-11)
-- Additief only — GEEN table-rebuild op productie. Eén keer draaien (niet idempotent).
-- Toepassen: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-events-v3.sql

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventVendorRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventVendorRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventVendorRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");
CREATE INDEX "EventRsvp_userId_idx" ON "EventRsvp"("userId");
CREATE INDEX "EventRsvp_eventId_status_idx" ON "EventRsvp"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventVendorRequest_eventId_userId_key" ON "EventVendorRequest"("eventId", "userId");
CREATE INDEX "EventVendorRequest_userId_idx" ON "EventVendorRequest"("userId");
CREATE INDEX "EventVendorRequest_eventId_status_idx" ON "EventVendorRequest"("eventId", "status");
