import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import { loadFulfillmentDetailCustomization } from '@/lib/fulfillment-detail-customization-store'
import FulfillmentCreatePageClient from '@/components/FulfillmentCreatePageClient'
import type { FulfillmentLineRow } from '@/components/FulfillmentLineItemsSection'

export default async function NewFulfillmentPage({
  searchParams,
}: {
  searchParams?: Promise<{ duplicateFrom?: string }>
}) {
  const duplicateFrom = (await searchParams)?.duplicateFrom?.trim()

  const [salesOrders, statusValues, customization, duplicateSource] = await Promise.all([
    prisma.salesOrder.findMany({
      include: {
        customer: true,
        quote: { include: { opportunity: true } },
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
        lineItems: {
          orderBy: { createdAt: 'asc' },
          include: {
            item: { select: { id: true, itemId: true, name: true } },
            fulfillmentLines: { select: { quantity: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadListValues('FULFILL-STATUS'),
    loadFulfillmentDetailCustomization(),
    duplicateFrom
      ? prisma.fulfillment.findUnique({
          where: { id: duplicateFrom },
          include: {
            lines: {
              include: {
                salesOrderLineItem: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  const eligibleSalesOrders = salesOrders
    .map((salesOrder) => ({
      id: salesOrder.id,
      number: salesOrder.number,
      customer: {
        name: salesOrder.customer.name,
        customerId: salesOrder.customer.customerId ?? null,
        email: salesOrder.customer.email ?? null,
      },
      quoteNumber: salesOrder.quote?.number ?? null,
      opportunityNumber: salesOrder.quote?.opportunity?.opportunityNumber ?? null,
      subsidiaryId: salesOrder.subsidiaryId ?? null,
      subsidiaryLabel: salesOrder.subsidiary
        ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}`
        : '-',
      currencyId: salesOrder.currencyId ?? null,
      currencyLabel: salesOrder.currency
        ? `${salesOrder.currency.code ?? salesOrder.currency.currencyId} - ${salesOrder.currency.name}`
        : '-',
      lines: salesOrder.lineItems
        .map((line, index) => {
          const alreadyFulfilled = line.fulfillmentLines.reduce((sum, fulfillmentLine) => sum + fulfillmentLine.quantity, 0)
          const openQuantity = Math.max(0, line.quantity - alreadyFulfilled)
          return {
            id: line.id,
            lineNumber: index + 1,
            itemId: line.item?.itemId ?? null,
            itemName: line.item?.name ?? null,
            description: line.description,
            orderedQuantity: line.quantity,
            alreadyFulfilledQuantity: alreadyFulfilled,
            openQuantity,
          }
        })
        .filter((line) => line.openQuantity > 0),
    }))
    .filter((salesOrder) => salesOrder.lines.length > 0)

  const initialSalesOrderId = duplicateSource?.salesOrderId ?? null
  const duplicateSalesOrder = initialSalesOrderId
    ? eligibleSalesOrders.find((salesOrder) => salesOrder.id === initialSalesOrderId) ?? null
    : null
  const initialLineRows: FulfillmentLineRow[] | undefined =
    duplicateSource && duplicateSalesOrder
      ? duplicateSource.lines.reduce<FulfillmentLineRow[]>((rows, line) => {
          const matchingOption = duplicateSalesOrder.lines.find((option) => option.id === line.salesOrderLineItemId)
          if (!matchingOption) return rows

          rows.push({
            id: `draft-${matchingOption.id}`,
            salesOrderLineItemId: matchingOption.id,
            lineNumber: matchingOption.lineNumber,
            itemId: matchingOption.itemId,
            itemName: matchingOption.itemName,
            description: matchingOption.description,
            orderedQuantity: matchingOption.orderedQuantity,
            alreadyFulfilledQuantity: matchingOption.alreadyFulfilledQuantity,
            openQuantity: matchingOption.openQuantity,
            fulfillmentQuantity: Math.min(line.quantity, matchingOption.openQuantity),
            notes: line.notes ?? '',
          })

          return rows
        }, [])
      : undefined

  return (
    <FulfillmentCreatePageClient
      salesOrders={eligibleSalesOrders}
      statusOptions={statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
      customization={customization}
      initialSalesOrderId={initialSalesOrderId}
      initialHeaderValues={
        duplicateSource
          ? {
              status: duplicateSource.status,
              date: duplicateSource.date.toISOString().slice(0, 10),
              notes: duplicateSource.notes ?? '',
              subsidiaryId: duplicateSource.subsidiaryId ?? '',
              currencyId: duplicateSource.currencyId ?? '',
            }
          : undefined
      }
      initialLineRows={initialLineRows}
    />
  )
}
