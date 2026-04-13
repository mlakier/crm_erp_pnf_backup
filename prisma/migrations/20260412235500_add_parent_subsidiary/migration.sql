ALTER TABLE "subsidiaries"
ADD COLUMN "parentEntityId" TEXT;

ALTER TABLE "subsidiaries"
ADD CONSTRAINT "subsidiaries_parentEntityId_fkey"
FOREIGN KEY ("parentEntityId") REFERENCES "subsidiaries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "subsidiaries_parentEntityId_idx" ON "subsidiaries"("parentEntityId");