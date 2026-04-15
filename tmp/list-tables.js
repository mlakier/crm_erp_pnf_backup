const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const rows = await p.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations' ORDER BY tablename"
  )
  rows.forEach(r => console.log(r.tablename))
  await p.$disconnect()
}
main()
