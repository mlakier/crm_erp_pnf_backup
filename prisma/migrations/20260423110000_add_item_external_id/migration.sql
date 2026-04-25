-- Add optional integration identifier for items. Existing rows remain NULL.
ALTER TABLE "items" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "items_externalId_key" ON "items"("externalId");
