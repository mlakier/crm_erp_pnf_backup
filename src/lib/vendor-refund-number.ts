import { prisma } from '@/lib/prisma'

function parseSequence(value: string | null | undefined) {
  if (!value) return 0
  const match = value.match(/^VRF-(\d+)$/i)
  return match ? Number.parseInt(match[1], 10) || 0 : 0
}

export async function generateVendorRefundNumber(): Promise<string> {
  const existing = await prisma.vendorRefund.findMany({
    where: { number: { startsWith: 'VRF-' } },
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 200,
  })

  const nextSequence = existing.reduce((max, record) => Math.max(max, parseSequence(record.number)), 0) + 1
  return `VRF-${nextSequence}`
}
