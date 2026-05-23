-- Per-user workspaces: categories are owned by a Supabase auth user id.
DELETE FROM "Solution";
DELETE FROM "Question";
DELETE FROM "Category";

ALTER TABLE "Category" ADD COLUMN "userId" TEXT NOT NULL;

CREATE INDEX "Category_userId_idx" ON "Category"("userId");
