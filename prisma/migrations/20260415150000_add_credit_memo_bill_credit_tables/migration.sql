-- CreateTable: credit_memos
CREATE TABLE "credit_memos" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,
    "entityId" TEXT,
    "currencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "credit_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable: credit_memo_line_items
CREATE TABLE "credit_memo_line_items" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creditMemoId" TEXT NOT NULL,
    "itemId" TEXT,

    CONSTRAINT "credit_memo_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bill_credits
CREATE TABLE "bill_credits" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "bill_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bill_credit_line_items
CREATE TABLE "bill_credit_line_items" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "billCreditId" TEXT NOT NULL,
    "itemId" TEXT,

    CONSTRAINT "bill_credit_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_memos_number_key" ON "credit_memos"("number");

-- CreateIndex
CREATE INDEX "credit_memos_entityId_idx" ON "credit_memos"("entityId");

-- CreateIndex
CREATE INDEX "credit_memos_currencyId_idx" ON "credit_memos"("currencyId");

-- CreateIndex
CREATE INDEX "credit_memo_line_items_itemId_idx" ON "credit_memo_line_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_credits_number_key" ON "bill_credits"("number");

-- CreateIndex
CREATE INDEX "bill_credit_line_items_itemId_idx" ON "bill_credit_line_items"("itemId");

-- AddForeignKey: credit_memos
ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: credit_memo_line_items
ALTER TABLE "credit_memo_line_items" ADD CONSTRAINT "credit_memo_line_items_creditMemoId_fkey" FOREIGN KEY ("creditMemoId") REFERENCES "credit_memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_memo_line_items" ADD CONSTRAINT "credit_memo_line_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: bill_credits
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bill_credit_line_items
ALTER TABLE "bill_credit_line_items" ADD CONSTRAINT "bill_credit_line_items_billCreditId_fkey" FOREIGN KEY ("billCreditId") REFERENCES "bill_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bill_credit_line_items" ADD CONSTRAINT "bill_credit_line_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
