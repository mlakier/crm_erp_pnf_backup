const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const rows = await p.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('estimates', 'quotes') ORDER BY tablename"
  )
  console.log('Tables found:', rows.map(r => r.tablename))
  await p.$disconnect()
}
main()
