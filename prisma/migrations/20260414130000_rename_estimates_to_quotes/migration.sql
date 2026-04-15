-- Rename table
ALTER TABLE "estimates" RENAME TO "quotes";

-- Rename constraints
ALTER TABLE "quotes" RENAME CONSTRAINT "estimates_pkey" TO "quotes_pkey";
ALTER TABLE "quotes" RENAME CONSTRAINT "estimates_customerId_fkey" TO "quotes_customerId_fkey";
ALTER TABLE "quotes" RENAME CONSTRAINT "estimates_userId_fkey" TO "quotes_userId_fkey";
ALTER TABLE "quotes" RENAME CONSTRAINT "estimates_opportunityId_fkey" TO "quotes_opportunityId_fkey";
ALTER TABLE "quotes" RENAME CONSTRAINT "estimates_entityId_fkey" TO "quotes_entityId_fkey";
ALTER TABLE "quotes" RENAME CONSTRAINT "estimates_currencyId_fkey" TO "quotes_currencyId_fkey";

-- Rename indexes
ALTER INDEX "estimates_number_key" RENAME TO "quotes_number_key";
ALTER INDEX "estimates_opportunityId_key" RENAME TO "quotes_opportunityId_key";
ALTER INDEX "estimates_entityId_idx" RENAME TO "quotes_entityId_idx";
ALTER INDEX "estimates_currencyId_idx" RENAME TO "quotes_currencyId_idx";
