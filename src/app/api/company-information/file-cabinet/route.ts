import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import {
  CompanyCabinetFile,
  loadCompanyCabinetFiles,
  saveCompanyCabinetFiles,
} from '@/lib/company-file-cabinet-store'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'company-file-cabinet')

function sanitizeBaseName(name: string) {
  return name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file'
}

function safeExtension(name: string) {
  const ext = path.extname(name).toLowerCase()
  return ext.replace(/[^a-z0-9.]/g, '')
}

export async function GET() {
  const files = await loadCompanyCabinetFiles()
  return NextResponse.json({ files })
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const incoming = form.getAll('files').filter((value): value is File => value instanceof File)

    if (incoming.length === 0) {
      return NextResponse.json({ error: 'No files received' }, { status: 400 })
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const existing = await loadCompanyCabinetFiles()
    const uploadedAt = new Date().toISOString()
    const newEntries: CompanyCabinetFile[] = []

    for (const file of incoming) {
      if (!file.name || file.size <= 0) continue

      const base = sanitizeBaseName(file.name)
      const ext = safeExtension(file.name)
      const id = randomUUID()
      const storedName = `${base}-${Date.now()}-${id.slice(0, 8)}${ext}`
      const filePath = path.join(UPLOAD_DIR, storedName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, buffer)

      newEntries.push({
        id,
        originalName: file.name,
        storedName,
        url: `/uploads/company-file-cabinet/${storedName}`,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt,
      })
    }

    const merged = [...newEntries, ...existing]
    await saveCompanyCabinetFiles(merged)

    return NextResponse.json({ files: merged })
  } catch {
    return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string }
    const id = body?.id
    if (!id) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }

    const files = await loadCompanyCabinetFiles()
    const target = files.find((entry) => entry.id === id)
    if (!target) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const next = files.filter((entry) => entry.id !== id)
    await saveCompanyCabinetFiles(next)

    const filePath = path.join(UPLOAD_DIR, target.storedName)
    await fs.unlink(filePath).catch(() => undefined)

    return NextResponse.json({ files: next })
  } catch {
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
