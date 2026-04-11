const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const sampleVendors = [
  { name: 'Granite Industrial Supply', email: 'sales@granite.example.com', phone: '555-0201', address: '410 Supply Park, Cleveland, OH', taxId: 'GI-1001' },
  { name: 'Westline Office Group', email: 'orders@westline.example.com', phone: '555-0202', address: '12 Paper Mill Rd, Columbus, OH', taxId: 'WO-1002' },
  { name: 'Vertex Components', email: 'contact@vertexcomponents.example.com', phone: '555-0203', address: '88 Circuit Ave, San Jose, CA', taxId: 'VC-1003' },
  { name: 'Iron Bridge Equipment', email: 'support@ironbridge.example.com', phone: '555-0204', address: '73 Forge St, Pittsburgh, PA', taxId: 'IB-1004' },
  { name: 'Summit Packaging Co', email: 'hello@summitpack.example.com', phone: '555-0205', address: '101 Carton Blvd, Atlanta, GA', taxId: 'SP-1005' },
  { name: 'Nova Freight Systems', email: 'dispatch@novafreight.example.com', phone: '555-0206', address: '210 Transit Pkwy, Memphis, TN', taxId: 'NF-1006' },
  { name: 'Apex Safety Products', email: 'service@apexsafety.example.com', phone: '555-0207', address: '345 Safety Way, Tulsa, OK', taxId: 'AS-1007' },
  { name: 'BrightPath IT Services', email: 'team@brightpathit.example.com', phone: '555-0208', address: '99 Network Dr, Raleigh, NC', taxId: 'BP-1008' },
  { name: 'Clearwater Utilities Supply', email: 'procurement@clearwater.example.com', phone: '555-0209', address: '630 Pipeline Rd, Tampa, FL', taxId: 'CU-1009' },
  { name: 'Oakstone Facilities', email: 'vendor@oakstone.example.com', phone: '555-0210', address: '512 Service Loop, Nashville, TN', taxId: 'OF-1010' },
]

function formatVendorNumber(sequence) {
  return `VEND-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.vendor.findFirst({
    where: { vendorNumber: { not: null } },
    orderBy: { vendorNumber: 'desc' },
    select: { vendorNumber: true },
  })

  if (!latest || !latest.vendorNumber) {
    return 1
  }

  const parsed = Number.parseInt(latest.vendorNumber.replace('VEND-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  let sequence = await getStartingSequence()
  const created = []

  for (const vendor of sampleVendors) {
    const record = await prisma.vendor.create({
      data: {
        vendorNumber: formatVendorNumber(sequence),
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        taxId: vendor.taxId,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'vendor',
        entityId: record.id,
        action: 'create',
        summary: `Created vendor ${record.vendorNumber} ${record.name}`,
        userId: null,
      },
    })

    created.push({ id: record.id, vendorNumber: record.vendorNumber, name: record.name })
    sequence += 1
  }

  console.log(`Created ${created.length} vendors.`)
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
