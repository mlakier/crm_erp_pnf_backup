-- AlterTable
ALTER TABLE "employees" ADD COLUMN "eid" TEXT,
ADD COLUMN "laborType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_eid_key" ON "employees"("eid");
