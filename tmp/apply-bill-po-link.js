const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  await p.$executeRawUnsafe('ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT')
  await p.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "bills_purchaseOrderId_idx" ON "bills"("purchaseOrderId")')
  try {
    await p.$executeRawUnsafe('ALTER TABLE "bills" ADD CONSTRAINT "bills_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE')
  } catch (e) {
    if (!e.message.includes('already exists')) throw e
  }
  console.log('Done')
}

main().catch(e => console.error(e.message)).finally(() => p.$disconnect())
