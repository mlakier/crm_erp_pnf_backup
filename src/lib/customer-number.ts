import { prisma } from '@/lib/prisma'

const CUSTOMER_NUMBER_PREFIX = 'CUST-'
const CUSTOMER_NUMBER_WIDTH = 6

export function formatCustomerNumber(sequence: number) {
  return `${CUSTOMER_NUMBER_PREFIX}${String(sequence).padStart(CUSTOMER_NUMBER_WIDTH, '0')}`
}

export async function generateNextCustomerNumber() {
  const latestCustomer = await prisma.customer.findFirst({
    where: {
      customerNumber: {
        not: null,
      },
    },
    orderBy: {
      customerNumber: 'desc',
    },
    select: {
      customerNumber: true,
    },
  })

  const latestSequence = latestCustomer?.customerNumber
    ? Number.parseInt(latestCustomer.customerNumber.replace(CUSTOMER_NUMBER_PREFIX, ''), 10)
    : 0

  return formatCustomerNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}
