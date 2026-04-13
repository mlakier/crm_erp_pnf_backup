-- Rename customerNumber column to customerId in customers table
ALTER TABLE "customers" RENAME COLUMN "customerNumber" TO "customerId";

-- Drop old unique index
DROP INDEX "customers_customerNumber_key";

-- Create new unique index
CREATE UNIQUE INDEX "customers_customerId_key" ON "customers"("customerId");
