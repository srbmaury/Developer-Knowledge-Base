ALTER TABLE "Category" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Category_isPublic_idx" ON "Category"("isPublic");
