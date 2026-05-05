ALTER TABLE "open_item_applications"
ADD COLUMN "realizedFxGroupAmount" DECIMAL(18, 2);

ALTER TABLE "clearing_document_headers"
ADD COLUMN "realizedFxGroupAmount" DECIMAL(18, 2);

ALTER TABLE "clearing_document_lines"
ADD COLUMN "realizedFxGroupAmount" DECIMAL(18, 2);
