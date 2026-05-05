-- CreateTable
CREATE TABLE "vendor_refunds" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "bankAccountId" TEXT,
    "vendorId" TEXT NOT NULL,
    "billPaymentId" TEXT,
    "userId" TEXT,
    "subsidiaryId" TEXT,
    "currencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_refunds_number_key" ON "vendor_refunds"("number");

-- CreateIndex
CREATE INDEX "vendor_refunds_bankAccountId_idx" ON "vendor_refunds"("bankAccountId");

-- CreateIndex
CREATE INDEX "vendor_refunds_vendorId_idx" ON "vendor_refunds"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_refunds_billPaymentId_idx" ON "vendor_refunds"("billPaymentId");

-- CreateIndex
CREATE INDEX "vendor_refunds_userId_idx" ON "vendor_refunds"("userId");

-- CreateIndex
CREATE INDEX "vendor_refunds_subsidiaryId_idx" ON "vendor_refunds"("subsidiaryId");

-- CreateIndex
CREATE INDEX "vendor_refunds_currencyId_idx" ON "vendor_refunds"("currencyId");

-- AddForeignKey
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_billPaymentId_fkey" FOREIGN KEY ("billPaymentId") REFERENCES "bill_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
