-- Map Series + CardSet to their TCGdex counterparts and cache official metadata
-- so we can sync from TCGdex (Fase 2) without losing user-created/legacy rows.
ALTER TABLE "Series" ADD COLUMN "tcgdexSeriesId" TEXT;
ALTER TABLE "Series" ADD COLUMN "logoUrl" TEXT;
CREATE UNIQUE INDEX "Series_tcgdexSeriesId_key" ON "Series"("tcgdexSeriesId");

ALTER TABLE "CardSet" ADD COLUMN "tcgdexSetId" TEXT;
ALTER TABLE "CardSet" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "CardSet" ADD COLUMN "symbolUrl" TEXT;
ALTER TABLE "CardSet" ADD COLUMN "releaseDate" TEXT;
ALTER TABLE "CardSet" ADD COLUMN "cardCount" INTEGER;
CREATE UNIQUE INDEX "CardSet_tcgdexSetId_key" ON "CardSet"("tcgdexSetId");
