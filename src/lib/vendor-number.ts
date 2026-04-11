import { prisma } from '@/lib/prisma'

const VENDOR_NUMBER_PREFIX = 'VEND-'
const VENDOR_NUMBER_WIDTH = 6

export function formatVendorNumber(sequence: number) {
  return `${VENDOR_NUMBER_PREFIX}${String(sequence).padStart(VENDOR_NUMBER_WIDTH, '0')}`
}

export async function generateNextVendorNumber() {
  const latestVendor = await prisma.vendor.findFirst({
    where: {
      vendorNumber: {
        not: null,
      },
    },
    orderBy: {
      vendorNumber: 'desc',
    },
    select: {
      vendorNumber: true,
    },
  })

  const latestSequence = latestVendor?.vendorNumber
    ? Number.parseInt(latestVendor.vendorNumber.replace(VENDOR_NUMBER_PREFIX, ''), 10)
    : 0

  return formatVendorNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}
