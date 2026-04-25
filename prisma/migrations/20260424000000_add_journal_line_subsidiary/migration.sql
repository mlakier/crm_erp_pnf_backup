ALTER TABLE "journal_entry_line_items"
ADD COLUMN "subsidiaryId" TEXT;

CREATE INDEX "journal_entry_line_items_subsidiaryId_idx"
ON "journal_entry_line_items"("subsidiaryId");

ALTER TABLE "journal_entry_line_items"
ADD CONSTRAINT "journal_entry_line_items_subsidiaryId_fkey"
FOREIGN KEY ("subsidiaryId")
REFERENCES "subsidiaries"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
