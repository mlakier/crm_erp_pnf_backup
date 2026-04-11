const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const sampleCustomers = [
  { name: 'North Ridge Manufacturing', industry: 'Manufacturing', email: 'ops@northridge.example.com', phone: '555-0101', address: '1200 Ridge Ave, Chicago, IL' },
  { name: 'Blue Harbor Logistics', industry: 'Logistics', email: 'team@blueharbor.example.com', phone: '555-0102', address: '88 Harbor Way, Long Beach, CA' },
  { name: 'Pinecrest Health Group', industry: 'Healthcare', email: 'admin@pinecrest.example.com', phone: '555-0103', address: '42 Wellness Dr, Denver, CO' },
  { name: 'Atlas Field Services', industry: 'Services', email: 'contact@atlasfield.example.com', phone: '555-0104', address: '900 Service Rd, Dallas, TX' },
  { name: 'Summit Retail Partners', industry: 'Retail', email: 'hello@summitretail.example.com', phone: '555-0105', address: '77 Market St, Seattle, WA' },
  { name: 'Red Oak Construction', industry: 'Construction', email: 'projects@redoak.example.com', phone: '555-0106', address: '510 Build Blvd, Phoenix, AZ' },
  { name: 'Evergreen Foods', industry: 'Food & Beverage', email: 'sales@evergreenfoods.example.com', phone: '555-0107', address: '14 Orchard Ln, Portland, OR' },
  { name: 'Cobalt Data Systems', industry: 'Technology', email: 'info@cobaltdata.example.com', phone: '555-0108', address: '301 Binary Ave, Austin, TX' },
  { name: 'Harborview Properties', industry: 'Real Estate', email: 'leasing@harborview.example.com', phone: '555-0109', address: '220 Skyline Dr, Miami, FL' },
  { name: 'Silverline Energy', industry: 'Energy', email: 'accounts@silverline.example.com', phone: '555-0110', address: '640 Grid St, Houston, TX' },
]

function formatCustomerNumber(sequence) {
  return `CUST-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.customer.findFirst({
    where: { customerNumber: { not: null } },
    orderBy: { customerNumber: 'desc' },
    select: { customerNumber: true },
  })

  if (!latest || !latest.customerNumber) {
    return 1
  }

  const parsed = Number.parseInt(latest.customerNumber.replace('CUST-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: 'admin@example.com' },
    select: { id: true },
  })

  if (!owner) {
    throw new Error('Admin user not found. Cannot assign customer ownership.')
  }

  let sequence = await getStartingSequence()
  const created = []

  for (const customer of sampleCustomers) {
    const record = await prisma.customer.create({
      data: {
        customerNumber: formatCustomerNumber(sequence),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        industry: customer.industry,
        userId: owner.id,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'customer',
        entityId: record.id,
        action: 'create',
        summary: `Created customer ${record.customerNumber} ${record.name}`,
        userId: owner.id,
      },
    })

    created.push({ id: record.id, customerNumber: record.customerNumber, name: record.name })
    sequence += 1
  }

  console.log(`Created ${created.length} customers.`)
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
