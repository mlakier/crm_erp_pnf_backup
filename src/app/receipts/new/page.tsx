import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import ReceiptCreatePageClient from '@/components/ReceiptCreatePageClient'
import { loadReceiptDetailCustomization } from '@/lib/receipt-detail-customization-store'
import { canReceivePurchaseOrderLine } from '@/lib/item-business-rules'

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<{ duplicateFrom?: string }>
}) {
  const duplicateFrom = (await searchParams)?.duplicateFrom?.trim()

  const [purchaseOrders, statusValues, customization, duplicateSource] = await Promise.all([
    prisma.purchaseOrder.findMany({
      select: {
        id: true,
        number: true,
        userId: true,
        subsidiaryId: true,
        currencyId: true,
        subsidiary: {
          select: { subsidiaryId: true, name: true },
        },
        currency: {
          select: { currencyId: true, code: true, name: true },
        },
        lineItems: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            description: true,
            quantity: true,
            item: {
              select: {
                id: true,
                itemId: true,
                name: true,
                dropShipItem: true,
                specialOrderItem: true,
              },
            },
            receiptLines: {
              select: { id: true, quantity: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadListValues('RECEIPT-STATUS'),
    loadReceiptDetailCustomization(),
    duplicateFrom
      ? prisma.receipt.findUnique({
          where: { id: duplicateFrom },
          include: {
            lines: true,
          },
        })
      : Promise.resolve(null),
  ])

  return (
    <ReceiptCreatePageClient
      purchaseOrders={purchaseOrders.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        number: purchaseOrder.number,
        userId: purchaseOrder.userId,
        subsidiaryId: purchaseOrder.subsidiaryId,
        subsidiaryLabel: purchaseOrder.subsidiary
          ? `${purchaseOrder.subsidiary.subsidiaryId} - ${purchaseOrder.subsidiary.name}`
          : null,
        currencyId: purchaseOrder.currencyId,
        currencyLabel: purchaseOrder.currency
          ? `${purchaseOrder.currency.code ?? purchaseOrder.currency.currencyId} - ${purchaseOrder.currency.name}`
          : null,
        lineOptions: purchaseOrder.lineItems.map((line, index) => ({
          id: line.id,
          lineNumber: index + 1,
          itemId: line.item?.itemId ?? null,
          itemName: line.item?.name ?? null,
          description: line.description,
          orderedQuantity: line.quantity,
          alreadyReceivedQuantity: line.receiptLines.reduce((sum, receiptLine) => sum + receiptLine.quantity, 0),
          openQuantity: Math.max(0, line.quantity - line.receiptLines.reduce((sum, receiptLine) => sum + receiptLine.quantity, 0)),
          receivable: canReceivePurchaseOrderLine(line.item),
        })),
      }))}
      statusOptions={statusValues.map((value) => ({
        value: value.toLowerCase(),
        label: value,
      }))}
      customization={customization}
      initialHeaderValues={
        duplicateSource
          ? {
              purchaseOrderId: duplicateSource.purchaseOrderId,
              subsidiaryId: '',
              currencyId: '',
              quantity: String(duplicateSource.quantity),
              date: duplicateSource.date.toISOString().slice(0, 10),
              status: duplicateSource.status,
              notes: duplicateSource.notes ?? '',
            }
          : undefined
      }
      initialLineItems={
        duplicateSource?.lines.map((line) => ({
          id: line.id,
          purchaseOrderLineItemId: line.purchaseOrderLineItemId,
          receiptQuantity: line.quantity,
          notes: line.notes ?? '',
        })) ?? []
      }
    />
  )
}
