-- Add entityId and currencyId to bill_credits
ALTER TABLE "bill_credits" ADD COLUMN "entityId" TEXT;
ALTER TABLE "bill_credits" ADD COLUMN "currencyId" TEXT;

-- CreateIndex
CREATE INDEX "bill_credits_entityId_idx" ON "bill_credits"("entityId");
CREATE INDEX "bill_credits_currencyId_idx" ON "bill_credits"("currencyId");

-- AddForeignKey
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
