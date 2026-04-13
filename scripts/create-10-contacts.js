const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const sampleContacts = [
  { firstName: 'Megan', lastName: 'Brooks', position: 'Operations Manager', email: 'megan.brooks@example.com', phone: '555-0301' },
  { firstName: 'Daniel', lastName: 'Kim', position: 'Procurement Lead', email: 'daniel.kim@example.com', phone: '555-0302' },
  { firstName: 'Alicia', lastName: 'Turner', position: 'Finance Director', email: 'alicia.turner@example.com', phone: '555-0303' },
  { firstName: 'Marcus', lastName: 'Reed', position: 'Plant Controller', email: 'marcus.reed@example.com', phone: '555-0304' },
  { firstName: 'Priya', lastName: 'Shah', position: 'Sales Operations', email: 'priya.shah@example.com', phone: '555-0305' },
  { firstName: 'Jonah', lastName: 'Perry', position: 'Warehouse Supervisor', email: 'jonah.perry@example.com', phone: '555-0306' },
  { firstName: 'Elena', lastName: 'Garcia', position: 'Regional Manager', email: 'elena.garcia@example.com', phone: '555-0307' },
  { firstName: 'Trevor', lastName: 'Miles', position: 'IT Business Partner', email: 'trevor.miles@example.com', phone: '555-0308' },
  { firstName: 'Naomi', lastName: 'Cole', position: 'Customer Success Lead', email: 'naomi.cole@example.com', phone: '555-0309' },
  { firstName: 'Victor', lastName: 'Hughes', position: 'VP Finance', email: 'victor.hughes@example.com', phone: '555-0310' },
]

function formatContactNumber(sequence) {
  return `CONT-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.contact.findFirst({
    where: { contactNumber: { not: null } },
    orderBy: { contactNumber: 'desc' },
    select: { contactNumber: true },
  })

  if (!latest || !latest.contactNumber) {
    return 1
  }

  const parsed = Number.parseInt(latest.contactNumber.replace('CONT-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  const customers = await prisma.customer.findMany({
    orderBy: { customerId: 'asc' },
    take: 10,
    select: { id: true, name: true, userId: true },
  })

  if (customers.length < 10) {
    throw new Error(`Expected at least 10 customers, found ${customers.length}.`)
  }

  let sequence = await getStartingSequence()
  const created = []

  for (let index = 0; index < sampleContacts.length; index += 1) {
    const contact = sampleContacts[index]
    const customer = customers[index]

    const record = await prisma.contact.create({
      data: {
        contactNumber: formatContactNumber(sequence),
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        position: contact.position,
        customerId: customer.id,
        userId: customer.userId,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'contact',
        entityId: record.id,
        action: 'create',
        summary: `Created contact ${record.contactNumber} ${record.firstName} ${record.lastName}`,
        userId: customer.userId,
      },
    })

    created.push({
      id: record.id,
      contactNumber: record.contactNumber,
      name: `${record.firstName} ${record.lastName}`,
      customer: customer.name,
    })
    sequence += 1
  }

  console.log(`Created ${created.length} contacts.`)
  console.log(JSON.stringify(created, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })