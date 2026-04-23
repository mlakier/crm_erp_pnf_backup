import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type PurchaseOrderPdfLine = {
  line: number
  itemId: string
  description: string
  quantity: number
  receivedQuantity: number
  openQuantity: number
  billedQuantity: number
  unitPrice: number
  lineTotal: number
}

export function downloadPurchaseOrderPdf({
  number,
  vendorName,
  vendorEmail,
  status,
  total,
  lines,
}: {
  number: string
  vendorName: string
  vendorEmail?: string | null
  status: string
  total: string
  lines: PurchaseOrderPdfLine[]
}) {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  pdf.setFontSize(16)
  pdf.text(`Purchase Order ${number}`, 10, 12)

  pdf.setFontSize(10)
  pdf.text(`Vendor: ${vendorName}`, 10, 20)
  if (vendorEmail) {
    pdf.text(`Vendor Email: ${vendorEmail}`, 10, 26)
  }
  pdf.text(`Status: ${status}`, 120, 20)
  pdf.text(`Total: ${total}`, 120, 26)

  autoTable(pdf, {
    startY: 34,
    head: [[
      'Line',
      'Item ID',
      'Description',
      'Qty',
      "Rec'd Qty",
      'Open Qty',
      'Billed Qty',
      'Unit Price',
      'Line Total',
    ]],
    body: lines.map((line) => [
      String(line.line),
      line.itemId || '-',
      line.description || '-',
      String(line.quantity),
      String(line.receivedQuantity),
      String(line.openQuantity),
      String(line.billedQuantity),
      line.unitPrice.toFixed(2),
      line.lineTotal.toFixed(2),
    ]),
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
    },
    margin: { top: 10, right: 8, bottom: 10, left: 8 },
  })

  pdf.save(`${number}.pdf`)
}
