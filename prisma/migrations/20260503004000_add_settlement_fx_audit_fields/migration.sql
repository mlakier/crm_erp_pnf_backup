ALTER TABLE "cash_receipts"
ADD COLUMN "fxRateType" TEXT,
ADD COLUMN "fxRateSource" TEXT,
ADD COLUMN "fxEffectiveDate" TIMESTAMP(3);

ALTER TABLE "bill_payments"
ADD COLUMN "fxRateType" TEXT,
ADD COLUMN "fxRateSource" TEXT,
ADD COLUMN "fxEffectiveDate" TIMESTAMP(3);
