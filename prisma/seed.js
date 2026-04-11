const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin',
      password: passwordHash,
      role: 'admin',
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      password: passwordHash,
      role: 'admin',
    },
  })

  console.log('Seed completed: admin@example.com / Admin123!')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })