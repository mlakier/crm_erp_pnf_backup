'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dagre from 'dagre'
import jsPDF from 'jspdf'

type SubsidiaryEntity = {
  id: string
  subsidiaryId: string
  name: string
  country: string | null
  entityType: string | null
  taxId: string | null
  parentSubsidiaryId: string | null
}

const NODE_WIDTH = 300
const NODE_HEIGHT = 100
const PADDING_X = 24
const PADDING_Y = 18
const TITLE_HEIGHT = 52
const EXPORT_PADDING = 18

// Larger dimensions for PDF export so text doesn't truncate when scaled to A4
const PDF_NODE_WIDTH = 340
const PDF_NODE_HEIGHT = 120
const PDF_PADDING_X = 36
const PDF_PADDING_Y = 28
const PDF_TITLE_HEIGHT = 64
const PDF_EXPORT_PADDING = 28

function truncateCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text
  }

  const ellipsis = '...'
  let value = text
  while (value.length > 0 && ctx.measureText(`${value}${ellipsis}`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value}${ellipsis}`
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function normalizeCountryCode(countryCode: string | null): string | null {
  if (!countryCode) {
    return null
  }

  const normalized = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null
  }

  return normalized
}

function getFlagUrl(countryCode: string | null): string | null {
  const normalized = normalizeCountryCode(countryCode)
  if (!normalized) {
    return null
  }

  return `https://flagcdn.com/w20/${normalized.toLowerCase()}.png`
}

export default function SubsidiaryHierarchyFlow({
  entities,
  title = 'Group of Companies',
  logoUrl,
}: {
  entities: SubsidiaryEntity[]
  title?: string
  logoUrl?: string
}) {
  const chartCanvasRef = useRef<HTMLDivElement>(null)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSavingPdf, setIsSavingPdf] = useState(false)
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const saveMenuRef = useRef<HTMLDivElement>(null)

  const captureChartCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!chartCanvasRef.current) {
      return null
    }

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(frameWidth * scale)
    canvas.height = Math.ceil(frameHeight * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }

    ctx.scale(scale, scale)

    ctx.fillStyle = '#020817'
    ctx.fillRect(0, 0, frameWidth, frameHeight)

    const titleX = EXPORT_PADDING
    const titleY = EXPORT_PADDING
    const titleWidth = frameWidth - EXPORT_PADDING * 2

    // Title border bottom (no background fill — transparent)
    ctx.strokeStyle = 'rgba(100,116,139,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(titleX, titleY + TITLE_HEIGHT)
    ctx.lineTo(titleX + titleWidth, titleY + TITLE_HEIGHT)
    ctx.stroke()

    // Draw logo if available
    if (logoUrl) {
      try {
        const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error('Logo load failed'))
          img.src = logoUrl
        })
        const logoH = TITLE_HEIGHT - 8
        const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH
        ctx.drawImage(logoImg, titleX + 8, titleY + 4, logoW, logoH)
      } catch {
        // skip logo on export if it fails to load
      }
    }

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '600 17px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, frameWidth / 2, titleY + TITLE_HEIGHT / 2)

    const chartTop = EXPORT_PADDING + TITLE_HEIGHT

    ctx.save()
    ctx.translate(chartLeft, chartTop)
    ctx.strokeStyle = 'rgba(148,163,184,0.7)'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const edge of edges) {
      if (!edge.d) {
        continue
      }
      ctx.stroke(new Path2D(edge.d))
    }

    const flagUrls = Array.from(new Set(nodes.map((node) => getFlagUrl(node.country)).filter((url): url is string => Boolean(url))))
    const flagImageMap = new Map<string, HTMLImageElement>()
    await Promise.all(
      flagUrls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
              flagImageMap.set(url, img)
              resolve()
            }
            img.onerror = () => resolve()
            img.src = url
          })
      )
    )

    for (const node of nodes) {
      const nodeX = node.x
      const nodeY = node.y

      const gradient = ctx.createLinearGradient(0, nodeY, 0, nodeY + NODE_HEIGHT)
      gradient.addColorStop(0, 'rgba(30,41,59,0.96)')
      gradient.addColorStop(1, 'rgba(15,23,42,0.95)')
      drawRoundedRect(ctx, nodeX, nodeY, NODE_WIDTH, NODE_HEIGHT, 12)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = 'rgba(71,85,105,0.9)'
      ctx.lineWidth = 1
      ctx.stroke()

      const contentX = nodeX + NODE_WIDTH / 2
      const textMaxWidth = NODE_WIDTH - 36

      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#3b82f6'
      ctx.font = '600 15px system-ui, sans-serif'
      const nameText = truncateCanvasText(ctx, `${node.subsidiaryId} - ${node.name}`, textMaxWidth)
      ctx.fillText(nameText, contentX, nodeY + 14)

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '500 13px system-ui, sans-serif'
      const typeText = truncateCanvasText(ctx, `Type: ${node.entityType ?? '-'}`, textMaxWidth)
      ctx.fillText(typeText, contentX, nodeY + 38)

      const taxText = truncateCanvasText(ctx, `Tax ID: ${node.taxId ?? '-'}`, textMaxWidth)
      ctx.fillText(taxText, contentX, nodeY + 58)

      const flagUrl = getFlagUrl(node.country)
      if (flagUrl) {
        const flagImage = flagImageMap.get(flagUrl)
        if (flagImage) {
          const flagX = nodeX + 14
          const flagY = nodeY + NODE_HEIGHT - 20
          const flagWidth = 20
          const flagHeight = 14
          ctx.drawImage(flagImage, flagX, flagY, flagWidth, flagHeight)
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'
          ctx.lineWidth = 1
          ctx.strokeRect(flagX, flagY, flagWidth, flagHeight)
        }
      }
    }

    ctx.restore()
    return canvas
  }

  const handleSaveAsImage = async (format: 'png' | 'jpg') => {
    if (isSavingImage || isSavingPdf) {
      return
    }

    setIsSavingImage(true)
    try {
      const canvas = await captureChartCanvas()
      if (!canvas) {
        return
      }

      const timestamp = new Date().toISOString().slice(0, 10)
      const isJpg = format === 'jpg'
      const mimeType = isJpg ? 'image/jpeg' : 'image/png'
      const quality = isJpg ? 0.95 : undefined
      const imageData = canvas.toDataURL(mimeType, quality)

      const anchor = document.createElement('a')
      anchor.href = imageData
      anchor.download = `subsidiary_hierarchy_${timestamp}.${format}`
      anchor.click()
    } catch (error) {
      console.error('Failed to save hierarchy image:', error)
    } finally {
      setIsSavingImage(false)
    }
  }

  const handleSaveToPdf = async () => {
    if (!chartCanvasRef.current || isSavingPdf) {
      return
    }

    setIsSavingPdf(false)
    setIsSavingPdf(true)
    try {
      // --- Build a larger layout specifically for PDF ---
      const pdfG = new dagre.graphlib.Graph()
      pdfG.setDefaultEdgeLabel(() => ({}))
      pdfG.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 80, marginx: 16, marginy: 16 })

      const pdfEntityById = new Map(entities.map((e) => [e.id, e]))
      for (const entity of entities) {
        pdfG.setNode(entity.id, { width: PDF_NODE_WIDTH, height: PDF_NODE_HEIGHT })
      }
      const pdfValidEdges: Array<{ parentId: string; childId: string }> = []
      for (const entity of entities) {
        if (entity.parentSubsidiaryId && pdfEntityById.has(entity.parentSubsidiaryId)) {
          pdfG.setEdge(entity.parentSubsidiaryId, entity.id)
          pdfValidEdges.push({ parentId: entity.parentSubsidiaryId, childId: entity.id })
        }
      }
      dagre.layout(pdfG)

      const pdfPositioned = entities.map((entity) => {
        const pos = pdfG.node(entity.id)
        return {
          id: entity.id,
          x: pos.x - PDF_NODE_WIDTH / 2,
          y: pos.y - PDF_NODE_HEIGHT / 2,
          subsidiaryId: entity.subsidiaryId,
          name: entity.name,
          country: entity.country,
          entityType: entity.entityType,
          taxId: entity.taxId,
        }
      })

      const pdfMinX = Math.min(...pdfPositioned.map((n) => n.x))
      const pdfMinY = Math.min(...pdfPositioned.map((n) => n.y))
      const pdfNodes = pdfPositioned.map((n) => ({
        ...n,
        x: n.x - pdfMinX + PDF_PADDING_X,
        y: n.y - pdfMinY + PDF_PADDING_Y,
      }))

      const pdfNodeById = new Map(pdfNodes.map((n) => [n.id, n]))
      const pdfEdges = pdfValidEdges.map(({ parentId, childId }) => {
        const parent = pdfNodeById.get(parentId)
        const child = pdfNodeById.get(childId)
        if (!parent || !child) return ''
        const sx = parent.x + PDF_NODE_WIDTH / 2
        const sy = parent.y + PDF_NODE_HEIGHT
        const ex = child.x + PDF_NODE_WIDTH / 2
        const ey = child.y
        const my = sy + (ey - sy) / 2
        return `M ${sx} ${sy} V ${my} H ${ex} V ${ey}`
      })

      const pdfContentW = Math.max(...pdfNodes.map((n) => n.x + PDF_NODE_WIDTH)) + PDF_PADDING_X
      const pdfContentH = Math.max(...pdfNodes.map((n) => n.y + PDF_NODE_HEIGHT)) + PDF_PADDING_Y
      const pdfWidth = Math.max(1200, Math.ceil(pdfContentW))
      const pdfHeight = Math.max(600, Math.ceil(pdfContentH))
      let pdfFrameW = Math.max(pdfWidth + PDF_EXPORT_PADDING * 2, 1200)
      const pdfFrameH = pdfHeight + PDF_TITLE_HEIGHT + PDF_EXPORT_PADDING * 2

      // Center root in PDF frame
      let pdfChartLeft = Math.max(PDF_EXPORT_PADDING, Math.floor((pdfFrameW - pdfWidth) / 2))
      const pdfRootEntity = entities.find((e) => !e.parentSubsidiaryId || !pdfEntityById.has(e.parentSubsidiaryId))
      if (pdfRootEntity) {
        const rn = pdfNodeById.get(pdfRootEntity.id)
        if (rn) {
          pdfChartLeft = Math.floor(pdfFrameW / 2 - rn.x - PDF_NODE_WIDTH / 2)
          if (pdfChartLeft + Math.min(...pdfNodes.map((n) => n.x)) < PDF_EXPORT_PADDING) {
            pdfChartLeft = PDF_EXPORT_PADDING - Math.min(...pdfNodes.map((n) => n.x))
          }
        }
      }
      pdfFrameW = Math.max(pdfFrameW, pdfChartLeft + pdfWidth + PDF_EXPORT_PADDING)

      // --- Render PDF canvas ---
      const pdfScale = 2
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(pdfFrameW * pdfScale)
      canvas.height = Math.ceil(pdfFrameH * pdfScale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.scale(pdfScale, pdfScale)
      ctx.fillStyle = '#020817'
      ctx.fillRect(0, 0, pdfFrameW, pdfFrameH)

      // Title bar
      const tX = PDF_EXPORT_PADDING
      const tY = PDF_EXPORT_PADDING
      const tW = pdfFrameW - PDF_EXPORT_PADDING * 2
      ctx.strokeStyle = 'rgba(100,116,139,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tX, tY + PDF_TITLE_HEIGHT)
      ctx.lineTo(tX + tW, tY + PDF_TITLE_HEIGHT)
      ctx.stroke()

      // Logo
      if (logoUrl) {
        try {
          const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Logo load failed'))
            img.src = logoUrl
          })
          const logoH = PDF_TITLE_HEIGHT - 12
          const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH
          ctx.drawImage(logoImg, tX + 10, tY + 6, logoW, logoH)
        } catch { /* skip */ }
      }

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '600 22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(title, pdfFrameW / 2, tY + PDF_TITLE_HEIGHT / 2)

      // Edges
      const chartTop = PDF_EXPORT_PADDING + PDF_TITLE_HEIGHT
      ctx.save()
      ctx.translate(pdfChartLeft, chartTop)
      ctx.strokeStyle = 'rgba(148,163,184,0.7)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const d of pdfEdges) {
        if (d) ctx.stroke(new Path2D(d))
      }

      // Flags
      const flagUrls = Array.from(new Set(pdfNodes.map((n) => getFlagUrl(n.country)).filter((u): u is string => Boolean(u))))
      const flagMap = new Map<string, HTMLImageElement>()
      await Promise.all(flagUrls.map((url) => new Promise<void>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { flagMap.set(url, img); resolve() }
        img.onerror = () => resolve()
        img.src = url
      })))

      // Nodes
      for (const node of pdfNodes) {
        const nx = node.x
        const ny = node.y
        const grad = ctx.createLinearGradient(0, ny, 0, ny + PDF_NODE_HEIGHT)
        grad.addColorStop(0, 'rgba(30,41,59,0.96)')
        grad.addColorStop(1, 'rgba(15,23,42,0.95)')
        drawRoundedRect(ctx, nx, ny, PDF_NODE_WIDTH, PDF_NODE_HEIGHT, 14)
        ctx.fillStyle = grad
        ctx.fill()
        ctx.strokeStyle = 'rgba(71,85,105,0.9)'
        ctx.lineWidth = 1
        ctx.stroke()

        const cx = nx + PDF_NODE_WIDTH / 2
        const maxTW = PDF_NODE_WIDTH - 40

        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = '#3b82f6'
        ctx.font = '600 16px system-ui, sans-serif'
        const nameT = truncateCanvasText(ctx, `${node.subsidiaryId} - ${node.name}`, maxTW)
        ctx.fillText(nameT, cx, ny + 16)

        ctx.fillStyle = '#cbd5e1'
        ctx.font = '500 14px system-ui, sans-serif'
        const typeT = truncateCanvasText(ctx, `Type: ${node.entityType ?? '-'}`, maxTW)
        ctx.fillText(typeT, cx, ny + 42)

        const taxT = truncateCanvasText(ctx, `Tax ID: ${node.taxId ?? '-'}`, maxTW)
        ctx.fillText(taxT, cx, ny + 64)

        const fUrl = getFlagUrl(node.country)
        if (fUrl) {
          const fImg = flagMap.get(fUrl)
          if (fImg) {
            const fx = nx + 16
            const fy = ny + PDF_NODE_HEIGHT - 28
            ctx.drawImage(fImg, fx, fy, 24, 17)
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'
            ctx.lineWidth = 1
            ctx.strokeRect(fx, fy, 24, 17)
          }
        }
      }
      ctx.restore()

      // Generate PDF
      const imageData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const maxW = pageWidth - margin * 2
      const maxH = pageHeight - margin * 2
      const sc = Math.min(maxW / canvas.width, maxH / canvas.height)
      const imageWidth = canvas.width * sc
      const imageHeight = canvas.height * sc
      const ix = margin + (maxW - imageWidth) / 2
      const iy = margin + (maxH - imageHeight) / 2

      pdf.addImage(imageData, 'PNG', ix, iy, imageWidth, imageHeight, undefined, 'FAST', 0)

      const timestamp = new Date().toISOString().slice(0, 10)
      pdf.save(`subsidiary_hierarchy_${timestamp}.pdf`)
    } catch (error) {
      console.error('Failed to save hierarchy PDF:', error)
    } finally {
      setIsSavingPdf(false)
    }
  }

  const { nodes, edges, width, height, frameWidth, frameHeight, chartLeft } = useMemo(() => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 62, marginx: 12, marginy: 12 })

    const entityById = new Map(entities.map((entity) => [entity.id, entity]))

    for (const entity of entities) {
      g.setNode(entity.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }

    const validEdges: Array<{ parentId: string; childId: string }> = []
    for (const entity of entities) {
      if (entity.parentSubsidiaryId && entityById.has(entity.parentSubsidiaryId)) {
        g.setEdge(entity.parentSubsidiaryId, entity.id)
        validEdges.push({ parentId: entity.parentSubsidiaryId, childId: entity.id })
      }
    }

    dagre.layout(g)

    const positionedNodes = entities.map((entity) => {
      const position = g.node(entity.id)
      return {
        id: entity.id,
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
        subsidiaryId: entity.subsidiaryId,
        name: entity.name,
        country: entity.country,
        entityType: entity.entityType,
        taxId: entity.taxId,
      }
    })

    const minX = Math.min(...positionedNodes.map((node) => node.x))
    const minY = Math.min(...positionedNodes.map((node) => node.y))

    const shiftedNodes = positionedNodes.map((node) => ({
      ...node,
      x: node.x - minX + PADDING_X,
      y: node.y - minY + PADDING_Y,
    }))

    const nodeById = new Map(shiftedNodes.map((node) => [node.id, node]))

    const connectorPaths = validEdges.map(({ parentId, childId }, index) => {
      const parent = nodeById.get(parentId)
      const child = nodeById.get(childId)
      if (!parent || !child) {
        return { id: `edge-${index}`, d: '' }
      }

      const startX = parent.x + NODE_WIDTH / 2
      const startY = parent.y + NODE_HEIGHT
      const endX = child.x + NODE_WIDTH / 2
      const endY = child.y
      const midY = startY + (endY - startY) / 2
      const d = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`
      return { id: `edge-${parentId}-${childId}-${index}`, d }
    })

    const contentWidth = Math.max(...shiftedNodes.map((node) => node.x + NODE_WIDTH)) + PADDING_X
    const contentHeight = Math.max(...shiftedNodes.map((node) => node.y + NODE_HEIGHT)) + PADDING_Y

    const computedWidth = Math.max(980, Math.ceil(contentWidth))
    const computedHeight = Math.max(420, Math.ceil(contentHeight))
    const computedFrameWidth = Math.max(computedWidth + EXPORT_PADDING * 2, 980)
    const computedFrameHeight = computedHeight + TITLE_HEIGHT + EXPORT_PADDING * 2

    // Center the root node horizontally within the frame
    let chartLeft = Math.max(EXPORT_PADDING, Math.floor((computedFrameWidth - computedWidth) / 2))
    const rootEntity = entities.find((e) => !e.parentSubsidiaryId || !entityById.has(e.parentSubsidiaryId))
    if (rootEntity) {
      const rootNode = nodeById.get(rootEntity.id)
      if (rootNode) {
        // Place chartLeft so rootNode center aligns with frame center
        chartLeft = Math.floor(computedFrameWidth / 2 - rootNode.x - NODE_WIDTH / 2)
        // Ensure no node extends past the left edge
        if (chartLeft + Math.min(...shiftedNodes.map((n) => n.x)) < EXPORT_PADDING) {
          chartLeft = EXPORT_PADDING - Math.min(...shiftedNodes.map((n) => n.x))
        }
      }
    }

    // Ensure the frame is wide enough for all nodes
    const requiredFrameWidth = Math.max(computedFrameWidth, chartLeft + computedWidth + EXPORT_PADDING)

    return {
      nodes: shiftedNodes,
      edges: connectorPaths,
      width: computedWidth,
      height: computedHeight,
      frameWidth: requiredFrameWidth,
      frameHeight: computedFrameHeight,
      chartLeft,
    }
  }, [entities])

  const isBusy = isSavingImage || isSavingPdf

  useEffect(() => {
    if (!saveMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (!saveMenuRef.current?.contains(e.target as Node)) setSaveMenuOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setSaveMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [saveMenuOpen])

  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <div className="relative" ref={saveMenuRef}>
          <button
            type="button"
            onClick={() => setSaveMenuOpen((v) => !v)}
            disabled={isBusy}
            className="rounded-md border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: 'var(--border-muted)',
              color: 'var(--text-secondary)',
              opacity: isBusy ? 0.65 : 1,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {isSavingImage ? 'Saving Image...' : isSavingPdf ? 'Saving PDF...' : 'Save As ▾'}
          </button>
          {saveMenuOpen && !isBusy ? (
            <div
              className="absolute right-0 z-50 mt-1 w-40 rounded-lg border py-1 shadow-xl"
              style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
            >
              <button
                type="button"
                onClick={() => { setSaveMenuOpen(false); handleSaveAsImage('png') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
              >
                PNG
              </button>
              <button
                type="button"
                onClick={() => { setSaveMenuOpen(false); handleSaveAsImage('jpg') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
              >
                JPG
              </button>
              <button
                type="button"
                onClick={() => { setSaveMenuOpen(false); handleSaveToPdf() }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
              >
                PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-full overflow-auto rounded-xl border flex justify-center" style={{ borderColor: 'var(--border-muted)' }}>
        <div
          ref={chartCanvasRef}
          className="relative shrink-0"
          style={{
            width: frameWidth,
            height: frameHeight,
          }}
        >
          <div
            className="absolute left-0 right-0 top-0 flex items-center border-b"
            style={{
              left: EXPORT_PADDING,
              right: EXPORT_PADDING,
              top: EXPORT_PADDING,
              height: TITLE_HEIGHT,
              borderColor: 'var(--border-muted)',
              color: 'var(--text-secondary)',
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Company logo"
                className="w-auto object-contain"
                style={{ height: TITLE_HEIGHT - 8, marginLeft: 8 }}
              />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center text-base font-semibold pointer-events-none">
              {title}
            </span>
          </div>

          <div
            className="absolute"
            style={{
              left: chartLeft,
              top: EXPORT_PADDING + TITLE_HEIGHT,
              width,
              height,
            }}
          >
          <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke="rgba(148,163,184,0.7)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {nodes.map((node) => {
            const flagUrl = getFlagUrl(node.country)

            return (
              <div
                key={node.id}
                className="absolute rounded-xl border px-3 py-2 text-center"
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  borderColor: 'var(--border-muted)',
                  background: 'linear-gradient(180deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.95) 100%)',
                  boxShadow: '0 6px 16px rgba(2,6,23,0.28)',
                }}
              >
                <Link
                  href={`/subsidiaries/${node.id}`}
                  className="block text-[13px] font-semibold leading-5 hover:underline"
                  style={{ color: 'var(--accent-primary-strong)' }}
                >
                  {node.subsidiaryId} - {node.name}
                </Link>
                <p className="mt-0.5 text-[11px] leading-4" style={{ color: 'var(--text-secondary)' }}>
                  Type: {node.entityType ?? '-'}
                </p>
                <p className="mt-0.5 text-[11px] leading-4" style={{ color: 'var(--text-secondary)' }}>
                  Tax ID: {node.taxId ?? '-'}
                </p>
                {flagUrl ? (
                  <img
                    src={flagUrl}
                    crossOrigin="anonymous"
                    alt={node.country ? `${node.country} flag` : 'Country flag'}
                    className="absolute bottom-2 left-3 h-3.5 w-5 rounded-[2px] border"
                    style={{ borderColor: 'rgba(255,255,255,0.25)' }}
                  />
                ) : (
                  <span
                    className="absolute bottom-2 left-3 text-[10px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    --
                  </span>
                )}
              </div>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}
