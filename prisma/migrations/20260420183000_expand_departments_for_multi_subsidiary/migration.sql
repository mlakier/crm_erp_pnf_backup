ALTER TABLE "departments"
  ADD COLUMN "departmentNumber" TEXT,
  ADD COLUMN "includeChildren" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "planningCategory" TEXT,
  ADD COLUMN "approverEmployeeId" TEXT;

CREATE TABLE "department_subsidiaries" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "department_subsidiaries_pkey" PRIMARY KEY ("id")
);

INSERT INTO "department_subsidiaries" ("id", "departmentId", "entityId", "createdAt")
SELECT
  CONCAT('deptsub_', md5("id" || '-' || "entityId")),
  "id",
  "entityId",
  CURRENT_TIMESTAMP
FROM "departments"
WHERE "entityId" IS NOT NULL;

CREATE UNIQUE INDEX "departments_departmentNumber_key" ON "departments"("departmentNumber");
CREATE UNIQUE INDEX "department_subsidiaries_departmentId_entityId_key" ON "department_subsidiaries"("departmentId", "entityId");
CREATE INDEX "department_subsidiaries_departmentId_idx" ON "department_subsidiaries"("departmentId");
CREATE INDEX "department_subsidiaries_entityId_idx" ON "department_subsidiaries"("entityId");
CREATE INDEX "departments_approverEmployeeId_idx" ON "departments"("approverEmployeeId");

ALTER TABLE "department_subsidiaries"
  ADD CONSTRAINT "department_subsidiaries_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_subsidiaries"
  ADD CONSTRAINT "department_subsidiaries_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_approverEmployeeId_fkey"
  FOREIGN KEY ("approverEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "departments_entityId_idx";
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_entityId_fkey";
ALTER TABLE "departments" DROP COLUMN IF EXISTS "entityId";
