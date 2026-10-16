-- Design-pass Fase C: ervaringen van spelers (admin-beheerd) voor /ervaringen
-- en de homepage. Additief; toepassen met:
--   npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-design-testimonials.sql

-- CreateTable
CREATE TABLE "ShopTestimonial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quote" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "source" TEXT NOT NULL DEFAULT 'IN_STORE',
    "sourceUrl" TEXT,
    "avatarUrl" TEXT,
    "color" TEXT NOT NULL DEFAULT 'white',
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ShopTestimonial_approved_featured_sortOrder_idx" ON "ShopTestimonial"("approved", "featured", "sortOrder");
