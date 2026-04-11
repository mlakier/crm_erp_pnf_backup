import { promises as fs } from 'fs'
import path from 'path'
import { FORM_REQUIREMENTS, FormKey, FormRequirementsMap } from '@/lib/form-requirements'

const STORE_PATH = path.join(process.cwd(), 'config', 'form-requirements.json')

function cloneDefaults(): FormRequirementsMap {
  return JSON.parse(JSON.stringify(FORM_REQUIREMENTS)) as FormRequirementsMap
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}

function mergeWithDefaults(overrides: Partial<FormRequirementsMap>): FormRequirementsMap {
  const merged = cloneDefaults()

  for (const form of Object.keys(merged) as FormKey[]) {
    const formOverrides = overrides[form]
    if (!formOverrides || typeof formOverrides !== 'object') continue

    for (const field of Object.keys(merged[form])) {
      if (Object.prototype.hasOwnProperty.call(formOverrides, field)) {
        merged[form][field] = normalizeBoolean((formOverrides as Record<string, unknown>)[field])
      }
    }
  }

  return merged
}

export async function loadFormRequirements(): Promise<FormRequirementsMap> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<FormRequirementsMap>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveFormRequirements(nextConfig: FormRequirementsMap): Promise<FormRequirementsMap> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}

export async function isFieldRequiredServer(form: FormKey, field: string): Promise<boolean> {
  const config = await loadFormRequirements()
  return Boolean(config[form]?.[field])
}
