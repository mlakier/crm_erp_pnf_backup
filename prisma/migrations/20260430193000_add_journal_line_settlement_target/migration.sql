ALTER TABLE "journal_entry_line_items"
ADD COLUMN "settles_open_item_id" TEXT;

CREATE INDEX "journal_entry_line_items_settles_open_item_id_idx"
ON "journal_entry_line_items"("settles_open_item_id");
