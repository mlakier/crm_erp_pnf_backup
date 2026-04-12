import { promises as fs } from 'fs'
import path from 'path'
import {
  DepartmentCustomizationConfig,
  cloneDepartmentCustomizationDefaults,
  mergeDepartmentCustomization,
} from '@/lib/department-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'department-customization.json')

export async function loadDepartmentCustomization(): Promise<DepartmentCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return mergeDepartmentCustomization(JSON.parse(raw))
  } catch {
    return cloneDepartmentCustomizationDefaults()
  }
}

export async function saveDepartmentCustomization(input: unknown): Promise<DepartmentCustomizationConfig> {
  const merged = mergeDepartmentCustomization(input)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
