ALTER TABLE "clearing_document_headers"
ADD COLUMN "groupCurrencyId" TEXT,
ADD COLUMN "groupAmount" DECIMAL(18,2);

ALTER TABLE "clearing_document_lines"
ADD COLUMN "groupAmount" DECIMAL(18,2);

CREATE INDEX "clearing_document_headers_groupCurrencyId_idx"
ON "clearing_document_headers"("groupCurrencyId");
