ALTER TABLE "journal_entry_line_items"
ADD COLUMN "localDebit" DECIMAL(18,2),
ADD COLUMN "localCredit" DECIMAL(18,2),
ADD COLUMN "functionalDebit" DECIMAL(18,2),
ADD COLUMN "functionalCredit" DECIMAL(18,2),
ADD COLUMN "groupDebit" DECIMAL(18,2),
ADD COLUMN "groupCredit" DECIMAL(18,2);
