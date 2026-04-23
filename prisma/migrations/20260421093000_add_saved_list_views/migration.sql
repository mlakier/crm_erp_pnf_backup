CREATE TABLE IF NOT EXISTS "saved_list_views" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "columnIds" TEXT NOT NULL,
  "columnOrder" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_list_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_list_views_userId_tableId_name_key" ON "saved_list_views"("userId", "tableId", "name");
CREATE INDEX IF NOT EXISTS "saved_list_views_userId_tableId_idx" ON "saved_list_views"("userId", "tableId");
CREATE INDEX IF NOT EXISTS "saved_list_views_userId_tableId_isDefault_idx" ON "saved_list_views"("userId", "tableId", "isDefault");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_list_views_userId_fkey') THEN
    ALTER TABLE "saved_list_views" ADD CONSTRAINT "saved_list_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
