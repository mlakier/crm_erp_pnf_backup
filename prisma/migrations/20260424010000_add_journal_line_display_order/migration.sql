ALTER TABLE "journal_entry_line_items"
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_lines AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "journalEntryId"
      ORDER BY "createdAt" ASC, id ASC
    ) - 1 AS next_display_order
  FROM "journal_entry_line_items"
)
UPDATE "journal_entry_line_items" AS target
SET "displayOrder" = ordered_lines.next_display_order
FROM ordered_lines
WHERE target.id = ordered_lines.id;
