-- AlterTable
ALTER TABLE "subsidiaries" RENAME CONSTRAINT "entities_pkey" TO "subsidiaries_pkey";

-- RenameForeignKey
ALTER TABLE "subsidiaries" RENAME CONSTRAINT "entities_defaultCurrencyId_fkey" TO "subsidiaries_defaultCurrencyId_fkey";

-- RenameIndex
ALTER INDEX "entities_code_key" RENAME TO "subsidiaries_code_key";

-- RenameIndex
ALTER INDEX "entities_defaultCurrencyId_idx" RENAME TO "subsidiaries_defaultCurrencyId_idx";
