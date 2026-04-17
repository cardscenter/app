-- AlterTable
ALTER TABLE "Card" ADD COLUMN "searchName" TEXT;

-- CreateIndex
CREATE INDEX "Card_searchName_idx" ON "Card"("searchName");
