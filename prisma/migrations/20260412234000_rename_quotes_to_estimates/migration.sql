ALTER TABLE "quotes" RENAME TO "estimates";

ALTER TABLE "estimates" RENAME CONSTRAINT "quotes_pkey" TO "estimates_pkey";
ALTER TABLE "estimates" RENAME CONSTRAINT "quotes_customerId_fkey" TO "estimates_customerId_fkey";
ALTER TABLE "estimates" RENAME CONSTRAINT "quotes_userId_fkey" TO "estimates_userId_fkey";
ALTER TABLE "estimates" RENAME CONSTRAINT "quotes_opportunityId_fkey" TO "estimates_opportunityId_fkey";
ALTER TABLE "estimates" RENAME CONSTRAINT "quotes_entityId_fkey" TO "estimates_entityId_fkey";
ALTER TABLE "estimates" RENAME CONSTRAINT "quotes_currencyId_fkey" TO "estimates_currencyId_fkey";

ALTER INDEX "quotes_number_key" RENAME TO "estimates_number_key";
ALTER INDEX "quotes_opportunityId_key" RENAME TO "estimates_opportunityId_key";
ALTER INDEX "quotes_entityId_idx" RENAME TO "estimates_entityId_idx";
ALTER INDEX "quotes_currencyId_idx" RENAME TO "estimates_currencyId_idx";
