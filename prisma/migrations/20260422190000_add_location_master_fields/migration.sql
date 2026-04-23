ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "parentLocationId" TEXT;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "locationType" TEXT;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "makeInventoryAvailable" BOOLEAN NOT NULL DEFAULT true;

WITH numbered_locations AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "code", "id") AS sequence_number
  FROM "locations"
  WHERE "locationId" IS NULL OR "locationId" = ''
)
UPDATE "locations"
SET "locationId" = 'LOC-' || LPAD(numbered_locations.sequence_number::text, 5, '0')
FROM numbered_locations
WHERE "locations"."id" = numbered_locations."id";

ALTER TABLE "locations" ALTER COLUMN "locationId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "locations_locationId_key" ON "locations"("locationId");
CREATE INDEX IF NOT EXISTS "locations_parentLocationId_idx" ON "locations"("parentLocationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_parentLocationId_fkey'
  ) THEN
    ALTER TABLE "locations"
      ADD CONSTRAINT "locations_parentLocationId_fkey"
      FOREIGN KEY ("parentLocationId") REFERENCES "locations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
