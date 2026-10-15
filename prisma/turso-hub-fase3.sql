
-- CreateTable
CREATE TABLE "EventType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" TEXT,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "ageDivisions" TEXT,
    "defaultPrice" REAL NOT NULL DEFAULT 0,
    "defaultCapacity" INTEGER,
    "countsForLeague" BOOLEAN NOT NULL DEFAULT false,
    "countsForStampCard" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "game" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "registrationOpensAt" DATETIME,
    "registrationDeadline" DATETIME,
    "price" REAL NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "underTwelveWithAdult" BOOLEAN NOT NULL DEFAULT true,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "countsForLeague" BOOLEAN NOT NULL DEFAULT false,
    "countsForStampCard" BOOLEAN NOT NULL DEFAULT true,
    "showParticipants" BOOLEAN NOT NULL DEFAULT true,
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "refundPolicy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "coverImage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopEvent_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EventType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShopEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "divisionKey" TEXT,
    "supervisedByAdult" BOOLEAN NOT NULL DEFAULT false,
    "ticketCode" TEXT NOT NULL,
    "qrSecret" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "paymentId" TEXT,
    "reservedUntil" DATETIME,
    "waitlistJoinedAt" DATETIME,
    "offerExpiresAt" DATETIME,
    "confirmedAt" DATETIME,
    "checkedInAt" DATETIME,
    "checkedInById" TEXT,
    "cancelledAt" DATETIME,
    "refundedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ShopEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRegistration_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'MOLLIE',
    "providerPaymentId" TEXT,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "checkoutUrl" TEXT,
    "metadata" TEXT,
    "refundedAmount" REAL NOT NULL DEFAULT 0,
    "providerRefundId" TEXT,
    "paidAt" DATETIME,
    "failedAt" DATETIME,
    "webhookCount" INTEGER NOT NULL DEFAULT 0,
    "lastWebhookAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EventType_key_key" ON "EventType"("key");

-- CreateIndex
CREATE INDEX "ShopEvent_status_startsAt_idx" ON "ShopEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "ShopEvent_typeId_idx" ON "ShopEvent"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_ticketCode_key" ON "EventRegistration"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_paymentId_key" ON "EventRegistration"("paymentId");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");

-- CreateIndex
CREATE INDEX "EventRegistration_status_reservedUntil_idx" ON "EventRegistration"("status", "reservedUntil");

-- CreateIndex
CREATE INDEX "EventRegistration_status_offerExpiresAt_idx" ON "EventRegistration"("status", "offerExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_userId_key" ON "EventRegistration"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_purpose_status_idx" ON "Payment"("purpose", "status");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

