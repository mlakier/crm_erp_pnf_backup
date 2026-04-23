-- AlterTable
ALTER TABLE "employees" ADD COLUMN "includeChildren" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "employee_subsidiaries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_subsidiaries_pkey" PRIMARY KEY ("id")
);

-- Backfill existing primary subsidiary links.
INSERT INTO "employee_subsidiaries" ("id", "employeeId", "entityId", "createdAt")
SELECT concat('emp_sub_', md5(random()::text || clock_timestamp()::text || "id")), "id", "entityId", CURRENT_TIMESTAMP
FROM "employees"
WHERE "entityId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "employee_subsidiaries_employeeId_entityId_key" ON "employee_subsidiaries"("employeeId", "entityId");

-- CreateIndex
CREATE INDEX "employee_subsidiaries_employeeId_idx" ON "employee_subsidiaries"("employeeId");

-- CreateIndex
CREATE INDEX "employee_subsidiaries_entityId_idx" ON "employee_subsidiaries"("entityId");

-- AddForeignKey
ALTER TABLE "employee_subsidiaries" ADD CONSTRAINT "employee_subsidiaries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_subsidiaries" ADD CONSTRAINT "employee_subsidiaries_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
