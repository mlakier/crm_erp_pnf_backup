import { promises as fs } from 'fs'
import path from 'path'

export type CompanyCabinetFile = {
  id: string
  originalName: string
  storedName: string
  url: string
  size: number
  type: string
  uploadedAt: string
}

const STORE_PATH = path.join(process.cwd(), 'config', 'company-file-cabinet.json')

export async function loadCompanyCabinetFiles(): Promise<CompanyCabinetFile[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as CompanyCabinetFile[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveCompanyCabinetFiles(files: CompanyCabinetFile[]) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(files, null, 2)}\n`, 'utf8')
}
