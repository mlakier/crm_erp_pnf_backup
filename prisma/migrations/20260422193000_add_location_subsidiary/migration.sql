-- Add optional subsidiary context to Locations.
ALTER TABLE "locations" ADD COLUMN "subsidiaryId" TEXT;

CREATE INDEX "locations_subsidiaryId_idx" ON "locations"("subsidiaryId");

ALTER TABLE "locations"
  ADD CONSTRAINT "locations_subsidiaryId_fkey"
  FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
