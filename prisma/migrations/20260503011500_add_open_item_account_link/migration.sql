ALTER TABLE "open_items"
ADD COLUMN "accountId" TEXT;

ALTER TABLE "open_items"
ADD CONSTRAINT "open_items_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "open_items_accountId_idx" ON "open_items"("accountId");
CREATE INDEX "open_items_accountId_isOpen_idx" ON "open_items"("accountId", "isOpen");
CREATE INDEX "open_items_accountId_subsidiaryId_isOpen_idx" ON "open_items"("accountId", "subsidiaryId", "isOpen");
