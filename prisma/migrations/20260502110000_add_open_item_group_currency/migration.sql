ALTER TABLE "open_items"
ADD COLUMN "groupCurrencyId" TEXT,
ADD COLUMN "originalGroupAmount" DECIMAL(18,2);

ALTER TABLE "open_item_entries"
ADD COLUMN "groupAmount" DECIMAL(18,2);

ALTER TABLE "open_item_applications"
ADD COLUMN "groupAmount" DECIMAL(18,2);

CREATE INDEX "open_items_groupCurrencyId_idx" ON "open_items"("groupCurrencyId");
