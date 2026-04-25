import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { generateNextCurrencyId } from '@/lib/currency-number'
import { generateNextLocationId } from '@/lib/location-number'
import { normalizeItemOrderFlags, validateItemOrderFlags } from '@/lib/item-business-rules'
import { getRequiredHeaders, isSupportedEntity } from '@/lib/master-data-import-schema'

export const runtime = 'nodejs'

type ImportMode = 'add' | 'update' | 'addOrUpdate'

type ImportError = { row: number; message: string }

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseBoolean(input: unknown, fallback: boolean): boolean {
  if (input === undefined || input === null || String(input).trim() === '') return fallback
  const normalized = String(input).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

function parseNumber(input: unknown, fallback: number): number {
  if (input === undefined || input === null || String(input).trim() === '') return fallback
  const value = Number(input)
  return Number.isFinite(value) ? value : fallback
}

function validateHeaders(data: Array<Record<string, string>>, requiredHeaders: string[], entity: string): { valid: boolean; error?: string } {
  if (data.length === 0) {
    return { valid: false, error: 'File is empty - no data rows found' }
  }

  const normalizedHeaders = new Set(Object.keys(data[0]).map(normalizeKey))
  const normalizedRequired = requiredHeaders.map(normalizeKey)
  const missingHeaders = normalizedRequired.filter((header) => !normalizedHeaders.has(header))

  if (missingHeaders.length > 0) {
    const missing = missingHeaders.map((h) => h.replace(/[^a-z0-9]/gi, (c) => (c.match(/[a-z]/i) ? c : ''))).join(', ')
    return {
      valid: false,
      error: `Missing required columns for ${entity}: ${missing}. Found columns: ${Array.from(normalizedHeaders).join(', ')}`,
    }
  }

  return { valid: true }
}

function parseRows(fileName: string, bytes: ArrayBuffer): Array<Record<string, string>> {
  const lowerName = fileName.toLowerCase()

  if (lowerName.endsWith('.xlsx')) {
    const workbook = XLSX.read(bytes, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const firstSheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
    return rows.map((row) => {
      const output: Record<string, string> = {}
      Object.entries(row).forEach(([key, value]) => {
        output[normalizeKey(key)] = String(value ?? '').trim()
      })
      return output
    })
  }

  const csvText = Buffer.from(bytes).toString('utf8')
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    const message = parsed.errors.map((error) => error.message).join('; ')
    throw new Error(`CSV parse error: ${message}`)
  }

  return (parsed.data ?? []).map((row) => {
    const output: Record<string, string> = {}
    Object.entries(row).forEach(([key, value]) => {
      output[normalizeKey(key)] = String(value ?? '').trim()
    })
    return output
  })
}

async function importCurrencies(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const code = (row.code ?? '').toUpperCase().trim()
    const name = (row.name ?? '').trim()
    const symbol = (row.symbol ?? '').trim()
    const decimalsStr = (row.decimals ?? '').trim()
    const isBaseStr = (row.isbase ?? '').trim()
    const activeStr = (row.active ?? '').trim()

    if (!code) {
      errors.push({ row: rowNumber, message: 'code is required (cannot be empty)' })
      continue
    }

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (code.length > 3) {
      errors.push({ row: rowNumber, message: `code must be 3 characters or less (got: "${code}")` })
      continue
    }

    // Validate decimals if provided
    if (decimalsStr && !/^\d+$/.test(decimalsStr)) {
      errors.push({ row: rowNumber, message: `decimals must be a number (got: "${decimalsStr}")` })
      continue
    }

    // Validate isBase if provided
    if (isBaseStr && !['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', ''].includes(isBaseStr.toLowerCase())) {
      errors.push({ row: rowNumber, message: `isBase must be true/false or 1/0 (got: "${isBaseStr}")` })
      continue
    }

    // Validate active if provided
    if (activeStr && !['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', ''].includes(activeStr.toLowerCase())) {
      errors.push({ row: rowNumber, message: `active must be true/false or 1/0 (got: "${activeStr}")` })
      continue
    }

    if (!dryRun) {
      const exists = await prisma.currency.findUnique({ where: { code } })
      
      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Currency "${code}" already exists (add mode)` })
        continue
      }
      
      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Currency "${code}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        await prisma.currency.upsert({
          where: { code },
          update: {
            name,
            symbol: symbol || code,
            decimals: parseNumber(decimalsStr, 2),
            isBase: parseBoolean(isBaseStr, false),
            active: parseBoolean(activeStr, true),
          },
          create: {
            currencyId: await generateNextCurrencyId(),
            code,
            name,
            symbol: symbol || code,
            decimals: parseNumber(decimalsStr, 2),
            isBase: parseBoolean(isBaseStr, false),
            active: parseBoolean(activeStr, true),
          },
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importSubsidiaries(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  const currencyCodes = Array.from(new Set(rows.map((row) => (row.defaultcurrencycode ?? '').toUpperCase()).filter(Boolean)))
  const currencies = await prisma.currency.findMany({
    where: { code: { in: currencyCodes } },
    select: { id: true, code: true },
  })
  const currencyMap = new Map(currencies.map((currency) => [currency.code.toUpperCase(), currency.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const code = (row.code ?? '').toUpperCase().trim()
    const name = (row.name ?? '').trim()
    const defaultCurrencyCode = (row.defaultcurrencycode ?? '').toUpperCase().trim()

    if (!code) {
      errors.push({ row: rowNumber, message: 'code is required (cannot be empty)' })
      continue
    }

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (defaultCurrencyCode && !currencyMap.has(defaultCurrencyCode)) {
      const availableCurrencies = Array.from(currencyMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `defaultCurrencyCode "${defaultCurrencyCode}" not found in system. Available: ${availableCurrencies || '(none - add currencies first)'}`,
      })
      continue
    }

    if (!dryRun) {
      const exists = await prisma.subsidiary.findUnique({ where: { subsidiaryId: code } })
      
      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Subsidiary "${code}" already exists (add mode)` })
        continue
      }
      
      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Subsidiary "${code}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        await prisma.subsidiary.upsert({
          where: { subsidiaryId: code },
          update: {
            name,
            legalName: (row.legalname ?? '').trim() || null,
            entityType: (row.entitytype ?? '').trim() || null,
            taxId: (row.taxid ?? '').trim() || null,
            registrationNumber: (row.registrationnumber ?? '').trim() || null,
            defaultCurrencyId: defaultCurrencyCode ? currencyMap.get(defaultCurrencyCode) ?? null : null,
            active: parseBoolean(row.active, true),
          },
          create: {
            subsidiaryId: code,
            name,
            legalName: (row.legalname ?? '').trim() || null,
            entityType: row.entitytype || null,
            taxId: row.taxid || null,
            registrationNumber: row.registrationnumber || null,
            defaultCurrencyId: defaultCurrencyCode ? currencyMap.get(defaultCurrencyCode) ?? null : null,
            active: parseBoolean(row.active, true),
          },
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importLocations(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0
  const parentIds = Array.from(new Set(rows.map((row) => (row.parentlocationid ?? '').toUpperCase().trim()).filter(Boolean)))
  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiaryid ?? row.subsidiarycode ?? '').toUpperCase().trim()).filter(Boolean)))
  const parents = await prisma.location.findMany({
    where: { locationId: { in: parentIds } },
    select: { id: true, locationId: true },
  })
  const parentMap = new Map(parents.map((location) => [location.locationId.toUpperCase(), location.id]))
  const subsidiaries = await prisma.subsidiary.findMany({
    where: { subsidiaryId: { in: subsidiaryCodes } },
    select: { id: true, subsidiaryId: true },
  })
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.subsidiaryId.toUpperCase(), subsidiary.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const providedLocationId = (row.locationid ?? '').toUpperCase().trim()
    const code = (row.code ?? '').toUpperCase().trim()
    const name = (row.name ?? '').trim()
    const subsidiaryCode = (row.subsidiaryid ?? row.subsidiarycode ?? '').toUpperCase().trim()
    const parentLocationNumber = (row.parentlocationid ?? '').toUpperCase().trim()

    if (!code || !name) {
      if (!code) errors.push({ row: rowNumber, message: 'code is required (cannot be empty)' })
      if (!name) errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (parentLocationNumber && !parentMap.has(parentLocationNumber)) {
      errors.push({ row: rowNumber, message: `parentLocationId "${parentLocationNumber}" not found.` })
      continue
    }
    if (subsidiaryCode && !subsidiaryMap.has(subsidiaryCode)) {
      errors.push({ row: rowNumber, message: `subsidiaryId "${subsidiaryCode}" not found.` })
      continue
    }

    if (!dryRun) {
      const exists = await prisma.location.findUnique({ where: { code } })
      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Location "${code}" already exists (add mode)` })
        continue
      }
      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Location "${code}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        const locationId = providedLocationId || exists?.locationId || await generateNextLocationId()
        await prisma.location.upsert({
          where: { code },
          update: {
            locationId,
            name,
            subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
            parentLocationId: parentLocationNumber ? parentMap.get(parentLocationNumber) ?? null : null,
            locationType: (row.locationtype ?? '').trim() || null,
            makeInventoryAvailable: parseBoolean(row.makeinventoryavailable, true),
            address: (row.address ?? '').trim() || null,
            inactive: !parseBoolean(row.active, true),
          },
          create: {
            locationId,
            code,
            name,
            subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
            parentLocationId: parentLocationNumber ? parentMap.get(parentLocationNumber) ?? null : null,
            locationType: (row.locationtype ?? '').trim() || null,
            makeInventoryAvailable: parseBoolean(row.makeinventoryavailable, true),
            address: (row.address ?? '').trim() || null,
            inactive: !parseBoolean(row.active, true),
          },
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importDepartments(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  const managerNumbers = Array.from(new Set(rows.map((row) => (row.manageremployeeid ?? row.manageremployeenumber ?? '').trim()).filter(Boolean)))
  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiarycode ?? '').toUpperCase()).filter(Boolean)))
  const managers = await prisma.employee.findMany({
    where: { employeeId: { in: managerNumbers } },
    select: { id: true, employeeId: true },
  })
  const subsidiaries = await prisma.subsidiary.findMany({
    where: { subsidiaryId: { in: subsidiaryCodes } },
    select: { id: true, subsidiaryId: true },
  })
  const managerMap = new Map(managers.map((manager) => [manager.employeeId ?? '', manager.id]))
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.subsidiaryId.toUpperCase(), subsidiary.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const departmentId = (row.code ?? '').toUpperCase()
    const name = row.name ?? ''
    const subsidiaryCode = (row.subsidiarycode ?? '').toUpperCase()
    const managerEmployeeNumber = (row.manageremployeeid ?? row.manageremployeenumber ?? '').trim()

    if (!departmentId || !name) {
      if (!departmentId) {
        errors.push({ row: rowNumber, message: 'departmentId is required (cannot be empty)' })
      }
      if (!name) {
        errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      }
      continue
    }

    if (managerEmployeeNumber && !managerMap.has(managerEmployeeNumber)) {
      const availableManagers = Array.from(managerMap.keys())
        .slice(0, 5)
        .join(', ')
      const count = managerMap.size
      errors.push({
        row: rowNumber,
        message: `managerEmployeeId "${managerEmployeeNumber}" not found (${count} employees available; examples: ${availableManagers || 'none'})`,
      })
      continue
    }

    if (subsidiaryCode && !subsidiaryMap.has(subsidiaryCode)) {
      const availableSubsidiaries = Array.from(subsidiaryMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `subsidiaryCode "${subsidiaryCode}" not found. Available: ${availableSubsidiaries || '(none - add subsidiaries first)'}`,
      })
      continue
    }

    if (!dryRun) {
      const exists = await prisma.department.findUnique({ where: { departmentId } })
      
      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Department "${departmentId}" already exists (add mode)` })
        continue
      }
      
      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Department "${departmentId}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        const assignedEntityId = subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null

        await prisma.department.upsert({
          where: { departmentId },
          update: {
            name,
            description: row.description || null,
            division: row.division || null,
            managerEmployeeId: managerEmployeeNumber ? managerMap.get(managerEmployeeNumber) ?? null : null,
            active: parseBoolean(row.active, true),
            departmentSubsidiaries: {
              deleteMany: {},
              ...(assignedEntityId
                ? {
                    create: [{ subsidiaryId: assignedEntityId }],
                  }
                : {}),
            },
          },
          create: {
            departmentId,
            name,
            description: row.description || null,
            division: row.division || null,
            managerEmployeeId: managerEmployeeNumber ? managerMap.get(managerEmployeeNumber) ?? null : null,
            active: parseBoolean(row.active, true),
            ...(assignedEntityId
              ? {
                  departmentSubsidiaries: {
                    create: [{ subsidiaryId: assignedEntityId }],
                  },
                }
              : {}),
          },
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importChartOfAccounts(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  const parentCodes = Array.from(
    new Set(rows.map((row) => (row.parentsubsidiarycode ?? '').toUpperCase().trim()).filter(Boolean))
  )
  const selectedCodes = Array.from(
    new Set(
      rows
        .flatMap((row) => (row.subsidiarycodes ?? '').split(','))
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    )
  )
  const allCodes = Array.from(new Set([...parentCodes, ...selectedCodes]))

  const subsidiaries = await prisma.subsidiary.findMany({
    where: { subsidiaryId: { in: allCodes } },
    select: { id: true, subsidiaryId: true },
  })
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.subsidiaryId.toUpperCase(), subsidiary.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const accountId = (row.accountid ?? '').trim()
    const accountNumber = (row.accountnumber ?? '').trim()
    const name = (row.name ?? '').trim()
    const accountType = (row.accounttype ?? '').trim()
    const scopeMode = ((row.scopemode ?? 'selected').trim().toLowerCase() || 'selected') as 'selected' | 'parent'
    const parentSubsidiaryCode = (row.parentsubsidiarycode ?? '').toUpperCase().trim()
    const selectedSubsidiaryCodes = (row.subsidiarycodes ?? '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)

    if (!accountNumber) {
      errors.push({ row: rowNumber, message: 'accountNumber is required (cannot be empty)' })
      continue
    }

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (!accountType) {
      errors.push({ row: rowNumber, message: 'accountType is required (cannot be empty)' })
      continue
    }

    if (scopeMode !== 'selected' && scopeMode !== 'parent') {
      errors.push({ row: rowNumber, message: 'scopeMode must be selected or parent' })
      continue
    }

    if (scopeMode === 'parent' && !parentSubsidiaryCode) {
      errors.push({ row: rowNumber, message: 'parentSubsidiaryCode is required when scopeMode=parent' })
      continue
    }

    if (scopeMode === 'parent' && parentSubsidiaryCode && !subsidiaryMap.has(parentSubsidiaryCode)) {
      errors.push({ row: rowNumber, message: `parentSubsidiaryCode "${parentSubsidiaryCode}" not found` })
      continue
    }

    if (scopeMode === 'selected' && selectedSubsidiaryCodes.length === 0) {
      errors.push({ row: rowNumber, message: 'subsidiaryCodes is required when scopeMode=selected' })
      continue
    }

    const missingSubsidiaries = selectedSubsidiaryCodes.filter((code) => !subsidiaryMap.has(code))
    if (missingSubsidiaries.length > 0) {
      errors.push({
        row: rowNumber,
        message: `Unknown subsidiaryCodes: ${missingSubsidiaries.join(', ')}`,
      })
      continue
    }

    if (!dryRun) {
      const exists = accountId
        ? await prisma.chartOfAccounts.findUnique({ where: { accountId } })
        : await prisma.chartOfAccounts.findUnique({ where: { accountNumber } })

      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Chart account "${accountId || accountNumber}" already exists (add mode)` })
        continue
      }

      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Chart account "${accountId || accountNumber}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        const upserted = await prisma.chartOfAccounts.upsert({
          where: { accountId: exists?.accountId ?? (accountId || `__missing__${rowNumber}`) },
          update: {
            ...(accountId ? { accountId } : {}),
            accountNumber,
            name,
            description: (row.description ?? '').trim() || null,
            accountType,
            inventory: parseBoolean(row.inventory, false),
            revalueOpenBalance: parseBoolean(row.revalueopenbalance, false),
            eliminateIntercoTransactions: parseBoolean(row.eliminateintercotransactions, false),
            summary: parseBoolean(row.summary, false),
            parentSubsidiaryId: scopeMode === 'parent' ? subsidiaryMap.get(parentSubsidiaryCode) ?? null : null,
            includeChildren: scopeMode === 'parent' ? parseBoolean(row.includechildren, false) : false,
          },
          create: {
            accountId: accountId || accountNumber,
            accountNumber,
            name,
            description: (row.description ?? '').trim() || null,
            accountType,
            inventory: parseBoolean(row.inventory, false),
            revalueOpenBalance: parseBoolean(row.revalueopenbalance, false),
            eliminateIntercoTransactions: parseBoolean(row.eliminateintercotransactions, false),
            summary: parseBoolean(row.summary, false),
            parentSubsidiaryId: scopeMode === 'parent' ? subsidiaryMap.get(parentSubsidiaryCode) ?? null : null,
            includeChildren: scopeMode === 'parent' ? parseBoolean(row.includechildren, false) : false,
          },
        })

        if (scopeMode === 'selected') {
          await prisma.chartOfAccountSubsidiary.deleteMany({ where: { chartOfAccountId: upserted.id } })
          if (selectedSubsidiaryCodes.length > 0) {
            await prisma.chartOfAccountSubsidiary.createMany({
              data: selectedSubsidiaryCodes.map((code) => ({
                chartOfAccountId: upserted.id,
                subsidiaryId: subsidiaryMap.get(code) ?? '',
              })),
              skipDuplicates: true,
            })
          }
        } else {
          await prisma.chartOfAccountSubsidiary.deleteMany({ where: { chartOfAccountId: upserted.id } })
        }
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importItems(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  const currencyCodes = Array.from(new Set(rows.map((row) => (row.currencycode ?? '').toUpperCase()).filter(Boolean)))
  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiarycode ?? '').toUpperCase()).filter(Boolean)))

  const [currencies, subsidiaries] = await Promise.all([
    prisma.currency.findMany({ where: { code: { in: currencyCodes } }, select: { id: true, code: true } }),
    prisma.subsidiary.findMany({ where: { subsidiaryId: { in: subsidiaryCodes } }, select: { id: true, subsidiaryId: true } }),
  ])

  const currencyMap = new Map(currencies.map((currency) => [currency.code.toUpperCase(), currency.id]))
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.subsidiaryId.toUpperCase(), subsidiary.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name ?? ''
    const itemId = (row.itemid ?? row.itemnumber ?? '').trim() || null
    const externalId = (row.externalid ?? '').trim() || null
    const sku = (row.sku ?? '').trim() || null
    const currencyCode = (row.currencycode ?? '').toUpperCase()
    const subsidiaryCode = (row.subsidiarycode ?? '').toUpperCase()
    const parsedDropShipItem = parseBoolean(row.dropshipitem, false)
    const parsedSpecialOrderItem = parseBoolean(row.specialorderitem, false)

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (!itemId && !sku) {
      errors.push({ row: rowNumber, message: 'itemId or sku is required for upsert key' })
      continue
    }

    if (currencyCode && !currencyMap.has(currencyCode)) {
      const availableCurrencies = Array.from(currencyMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `currencyCode "${currencyCode}" not found. Available: ${availableCurrencies || '(none - add currencies first)'}`,
      })
      continue
    }

    if (subsidiaryCode && !subsidiaryMap.has(subsidiaryCode)) {
      const availableSubsidiaries = Array.from(subsidiaryMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `subsidiaryCode "${subsidiaryCode}" not found. Available: ${availableSubsidiaries || '(none - add subsidiaries first)'}`,
      })
      continue
    }

    const orderFlagError = validateItemOrderFlags({ dropShipItem: parsedDropShipItem, specialOrderItem: parsedSpecialOrderItem })
    if (orderFlagError) {
      errors.push({ row: rowNumber, message: orderFlagError })
      continue
    }

    const { dropShipItem, specialOrderItem } = normalizeItemOrderFlags({
      dropShipItem: parsedDropShipItem,
      specialOrderItem: parsedSpecialOrderItem,
    })

    if (!dryRun) {
      // Check if record exists for mode validation
      let exists = false
      if (itemId) {
        const found = await prisma.item.findUnique({ where: { itemId } })
        exists = !!found
      } else if (sku) {
        const found = await prisma.item.findUnique({ where: { sku } })
        exists = !!found
      }

      if (mode === 'add' && exists) {
        const key = itemId || sku
        errors.push({ row: rowNumber, message: `Item "${key}" already exists (add mode)` })
        continue
      }

      if (mode === 'update' && !exists) {
        const key = itemId || sku
        errors.push({ row: rowNumber, message: `Item "${key}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        const updateData = {
          name,
          externalId,
          description: row.description || null,
          salesDescription: row.salesdescription || null,
          purchaseDescription: row.purchasedescription || null,
          itemType: row.itemtype || 'service',
          itemCategory: row.itemcategory || null,
          uom: row.uom || null,
          primaryPurchaseUnit: row.primarypurchaseunit || null,
          primarySaleUnit: row.primarysaleunit || null,
          primaryUnitsType: row.primaryunitstype || null,
          listPrice: parseNumber(row.listprice, 0),
          currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
          subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
          includeChildren: parseBoolean(row.includechildren, false),
          line: row.line || null,
          productLine: row.productline || null,
          dropShipItem,
          specialOrderItem,
          canBeFulfilled: parseBoolean(row.canbefulfilled, false),
          taxCode: row.taxcode || null,
          active: parseBoolean(row.active, true),
        }

        if (itemId) {
          await prisma.item.upsert({
            where: { itemId },
            update: { ...updateData, sku },
            create: { ...updateData, itemId, sku },
          })
        } else if (sku) {
          await prisma.item.upsert({
            where: { sku },
            update: { ...updateData, itemId },
            create: { ...updateData, itemId, sku },
          })
        }
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importEmployees(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0
  const parseCodeList = (value: string | undefined) => String(value ?? '').split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean)

  const departmentCodes = Array.from(new Set(rows.map((row) => (row.departmentcode ?? '').toUpperCase()).filter(Boolean)))
  const subsidiaryCodes = Array.from(new Set(rows.flatMap((row) => parseCodeList(row.subsidiaryids ?? row.subsidiarycode))))
  const managerNumbers = Array.from(new Set(rows.map((row) => (row.manageremployeeid ?? row.manageremployeenumber ?? '').trim()).filter(Boolean)))

  const [departments, subsidiaries, managers] = await Promise.all([
    prisma.department.findMany({ where: { departmentId: { in: departmentCodes } }, select: { id: true, departmentId: true } }),
    prisma.subsidiary.findMany({ where: { subsidiaryId: { in: subsidiaryCodes } }, select: { id: true, subsidiaryId: true } }),
    prisma.employee.findMany({ where: { employeeId: { in: managerNumbers } }, select: { id: true, employeeId: true } }),
  ])

  const departmentMap = new Map(departments.map((department) => [department.departmentId.toUpperCase(), department.id]))
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.subsidiaryId.toUpperCase(), subsidiary.id]))
  const managerMap = new Map(managers.map((manager) => [manager.employeeId ?? '', manager.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const firstName = row.firstname ?? ''
    const lastName = row.lastname ?? ''
    const employeeNumber = (row.employeeid ?? row.employeenumber ?? '').trim() || null
    const eid = (row.eid ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const departmentCode = (row.departmentcode ?? '').toUpperCase()
    const subsidiaryCodesForRow = parseCodeList(row.subsidiaryids ?? row.subsidiarycode)
    const managerEmployeeNumber = (row.manageremployeeid ?? row.manageremployeenumber ?? '').trim()

    if (!firstName || !lastName) {
      if (!firstName) {
        errors.push({ row: rowNumber, message: 'firstName is required (cannot be empty)' })
      }
      if (!lastName) {
        errors.push({ row: rowNumber, message: 'lastName is required (cannot be empty)' })
      }
      continue
    }

    if (!employeeNumber && !email) {
      errors.push({ row: rowNumber, message: 'employeeNumber or email is required for upsert key' })
      continue
    }

    if (departmentCode && !departmentMap.has(departmentCode)) {
      const availableDepartments = Array.from(departmentMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `departmentCode "${departmentCode}" not found. Available: ${availableDepartments || '(none - add departments first)'}`,
      })
      continue
    }

    const missingSubsidiaryCode = subsidiaryCodesForRow.find((code) => !subsidiaryMap.has(code))
    if (missingSubsidiaryCode) {
      const availableSubsidiaries = Array.from(subsidiaryMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `subsidiaryIds "${missingSubsidiaryCode}" not found. Available: ${availableSubsidiaries || '(none - add subsidiaries first)'}`,
      })
      continue
    }

    if (managerEmployeeNumber && !managerMap.has(managerEmployeeNumber)) {
      const availableManagers = Array.from(managerMap.keys())
        .slice(0, 5)
        .join(', ')
      const count = managerMap.size
      errors.push({
        row: rowNumber,
        message: `managerEmployeeId "${managerEmployeeNumber}" not found (${count} employees available; examples: ${availableManagers || 'none'})`,
      })
      continue
    }

    if (!dryRun) {
      // Check if record exists for mode validation
      let exists = false
      if (employeeNumber) {
        const found = await prisma.employee.findUnique({ where: { employeeId: employeeNumber } })
        exists = !!found
      } else if (email) {
        const found = await prisma.employee.findUnique({ where: { email } })
        exists = !!found
      }

      if (mode === 'add' && exists) {
        const key = employeeNumber || email
        errors.push({ row: rowNumber, message: `Employee "${key}" already exists (add mode)` })
        continue
      }

      if (mode === 'update' && !exists) {
        const key = employeeNumber || email
        errors.push({ row: rowNumber, message: `Employee "${key}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        const selectedSubsidiaryIds = subsidiaryCodesForRow.map((code) => subsidiaryMap.get(code)).filter((value): value is string => Boolean(value))
        const updateData = {
          firstName,
          lastName,
          email,
          phone: (row.phone ?? '').trim() || null,
          title: (row.title ?? '').trim() || null,
          eid,
          laborType: (row.labortype ?? '').trim() || null,
          departmentId: departmentCode ? departmentMap.get(departmentCode) ?? null : null,
          subsidiaryId: selectedSubsidiaryIds[0] ?? null,
          includeChildren: parseBoolean(row.includechildren, false),
          managerId: managerEmployeeNumber ? managerMap.get(managerEmployeeNumber) ?? null : null,
          active: parseBoolean(row.active, true),
        }
        const employeeSubsidiaries = {
          deleteMany: {},
          create: selectedSubsidiaryIds.map((subsidiaryId) => ({ subsidiaryId })),
        }

        if (employeeNumber) {
          await prisma.employee.upsert({
            where: { employeeId: employeeNumber },
            update: { ...updateData, employeeSubsidiaries },
            create: { ...updateData, employeeId: employeeNumber, employeeSubsidiaries },
          })
        } else if (email) {
          await prisma.employee.upsert({
            where: { email },
            update: { ...updateData, employeeId: employeeNumber, employeeSubsidiaries },
            create: { ...updateData, employeeId: employeeNumber, employeeSubsidiaries },
          })
        }
      }
    }


    succeeded += 1
  }

  return succeeded
}

async function importCustomers(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  // Get or create default system user for imports
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@import.local' },
  })
  if (!systemUser) {
    const { generateNextUserNumber } = await import('@/lib/user-number')
    const nextUserId = await generateNextUserNumber()
    systemUser = await prisma.user.create({
      data: {
        email: 'system@import.local',
        name: 'System Import User',
        password: 'system', // dummy password
        userId: nextUserId,
      },
    })
  }

  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiarycode ?? row.entitycode ?? '').toUpperCase()).filter(Boolean)))
  const currencyCodes = Array.from(new Set(rows.map((row) => (row.currencycode ?? '').toUpperCase()).filter(Boolean)))

  const [entities, currencies] = await Promise.all([
    prisma.subsidiary.findMany({ where: { subsidiaryId: { in: subsidiaryCodes } }, select: { id: true, subsidiaryId: true } }),
    prisma.currency.findMany({ where: { code: { in: currencyCodes } }, select: { id: true, code: true } }),
  ])

  const subsidiaryMap = new Map(entities.map((e) => [e.subsidiaryId.toUpperCase(), e.id]))
  const currencyMap = new Map(currencies.map((c) => [c.code.toUpperCase(), c.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name ?? ''
    const customerNumber = (row.customernumber ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const subsidiaryCode = (row.subsidiarycode ?? row.entitycode ?? '').toUpperCase()
    const currencyCode = (row.currencycode ?? '').toUpperCase().trim()

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (subsidiaryCode && !subsidiaryMap.has(subsidiaryCode)) {
      const availableSubsidiaries = Array.from(subsidiaryMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `subsidiaryCode "${subsidiaryCode}" not found. Available: ${availableSubsidiaries || '(none - add subsidiaries first)'}`,
      })
      continue
    }

    if (currencyCode && !currencyMap.has(currencyCode)) {
      const availableCurrencies = Array.from(currencyMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `currencyCode "${currencyCode}" not found. Available: ${availableCurrencies || '(none - add currencies first)'}`,
      })
      continue
    }

    if (!dryRun) {
      // Check if record exists for mode validation (only if customerNumber is provided)
      let exists = false
      if (customerNumber) {
        const found = await prisma.customer.findUnique({ where: { customerId: customerNumber } })
        exists = !!found
      }

      if (customerNumber) {
        // Mode validation only applies when there's a customerNumber
        if (mode === 'add' && exists) {
          errors.push({ row: rowNumber, message: `Customer "${customerNumber}" already exists (add mode)` })
          continue
        }

        if (mode === 'update' && !exists) {
          errors.push({ row: rowNumber, message: `Customer "${customerNumber}" does not exist (update mode)` })
          continue
        }

        if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
          const updateData = {
            name,
            email: email || null,
            phone: (row.phone ?? '').trim() || null,
            address: (row.address ?? '').trim() || null,
            industry: (row.industry ?? '').trim() || null,
            subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
            currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
          }

          await prisma.customer.upsert({
            where: { customerId: customerNumber },
            update: updateData,
            create: { ...updateData, customerId: customerNumber, userId: systemUser.id },
          })
        }
      } else {
        // Create without customerId - it will be auto-generated
        const updateData = {
          name,
          email: email || null,
          phone: (row.phone ?? '').trim() || null,
          address: (row.address ?? '').trim() || null,
          industry: (row.industry ?? '').trim() || null,
          subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
          currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
        }

        await prisma.customer.create({
          data: { ...updateData, userId: systemUser.id },
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importContacts(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  // Get or create default system user for imports
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@import.local' },
  })
  if (!systemUser) {
    const { generateNextUserNumber } = await import('@/lib/user-number')
    const nextUserId = await generateNextUserNumber()
    systemUser = await prisma.user.create({
      data: {
        email: 'system@import.local',
        name: 'System Import User',
        password: 'system', // dummy password
        userId: nextUserId,
      },
    })
  }

  const customerNumbers = Array.from(new Set(rows.map((row) => (row.customernumber ?? '').trim()).filter(Boolean)))
  const customers = await prisma.customer.findMany({
    where: { customerId: { in: customerNumbers } },
    select: { id: true, customerId: true },
  })
  const customerMap = new Map(customers.map((c) => [c.customerId ?? '', c.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const firstName = row.firstname ?? ''
    const lastName = row.lastname ?? ''
    const contactNumber = (row.contactnumber ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const customerNumber = (row.customernumber ?? '').trim()

    if (!firstName || !lastName) {
      if (!firstName) {
        errors.push({ row: rowNumber, message: 'firstName is required (cannot be empty)' })
      }
      if (!lastName) {
        errors.push({ row: rowNumber, message: 'lastName is required (cannot be empty)' })
      }
      continue
    }

    if (!customerNumber || !customerMap.has(customerNumber)) {
      const availableCustomers = Array.from(customerMap.keys())
        .slice(0, 5)
        .join(', ')
      const count = customerMap.size
      errors.push({
        row: rowNumber,
        message: `customerNumber "${customerNumber}" not found (${count} customers available; examples: ${availableCustomers || 'none'})`,
      })
      continue
    }

    if (!dryRun) {
      // Check if record exists for mode validation (only if contactNumber is provided)
      let exists = false
      if (contactNumber) {
        const found = await prisma.contact.findUnique({ where: { contactNumber } })
        exists = !!found
      }

      if (contactNumber) {
        // Mode validation only applies when there's a contactNumber
        if (mode === 'add' && exists) {
          errors.push({ row: rowNumber, message: `Contact "${contactNumber}" already exists (add mode)` })
          continue
        }

        if (mode === 'update' && !exists) {
          errors.push({ row: rowNumber, message: `Contact "${contactNumber}" does not exist (update mode)` })
          continue
        }

        if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
          const updateData = {
            firstName,
            lastName,
            email: email || null,
            phone: (row.phone ?? '').trim() || null,
            position: (row.position ?? '').trim() || null,
            customerId: customerMap.get(customerNumber) ?? '',
          }

          await prisma.contact.upsert({
            where: { contactNumber },
            update: updateData,
            create: { ...updateData, contactNumber, userId: systemUser.id },
          })
        }
      } else {
        // Create without contactNumber - it will be auto-generated
        const updateData = {
          firstName,
          lastName,
          email: email || null,
          phone: (row.phone ?? '').trim() || null,
          position: (row.position ?? '').trim() || null,
          customerId: customerMap.get(customerNumber) ?? '',
        }

        await prisma.contact.create({
          data: { ...updateData, userId: systemUser.id },
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

async function importVendors(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiarycode ?? row.entitycode ?? '').toUpperCase()).filter(Boolean)))
  const currencyCodes = Array.from(new Set(rows.map((row) => (row.currencycode ?? '').toUpperCase()).filter(Boolean)))

  const [entities, currencies] = await Promise.all([
    prisma.subsidiary.findMany({ where: { subsidiaryId: { in: subsidiaryCodes } }, select: { id: true, subsidiaryId: true } }),
    prisma.currency.findMany({ where: { code: { in: currencyCodes } }, select: { id: true, code: true } }),
  ])

  const subsidiaryMap = new Map(entities.map((e) => [e.subsidiaryId.toUpperCase(), e.id]))
  const currencyMap = new Map(currencies.map((c) => [c.code.toUpperCase(), c.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name ?? ''
    const vendorNumber = (row.vendornumber ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const subsidiaryCode = (row.subsidiarycode ?? row.entitycode ?? '').toUpperCase()
    const currencyCode = (row.currencycode ?? '').toUpperCase()

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (subsidiaryCode && !subsidiaryMap.has(subsidiaryCode)) {
      const availableSubsidiaries = Array.from(subsidiaryMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `subsidiaryCode "${subsidiaryCode}" not found. Available: ${availableSubsidiaries || '(none - add subsidiaries first)'}`,
      })
      continue
    }

    if (currencyCode && !currencyMap.has(currencyCode)) {
      const availableCurrencies = Array.from(currencyMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `currencyCode "${currencyCode}" not found. Available: ${availableCurrencies || '(none - add currencies first)'}`,
      })
      continue
    }

    if (!dryRun) {
      // Check if record exists for mode validation (only if vendorNumber is provided)
      let exists = false
      if (vendorNumber) {
        const found = await prisma.vendor.findUnique({ where: { vendorNumber } })
        exists = !!found
      }

      if (vendorNumber) {
        // Mode validation only applies when there's a vendorNumber
        if (mode === 'add' && exists) {
          errors.push({ row: rowNumber, message: `Vendor "${vendorNumber}" already exists (add mode)` })
          continue
        }

        if (mode === 'update' && !exists) {
          errors.push({ row: rowNumber, message: `Vendor "${vendorNumber}" does not exist (update mode)` })
          continue
        }

        if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
          const updateData = {
            name,
            email: email || null,
            phone: (row.phone ?? '').trim() || null,
            address: (row.address ?? '').trim() || null,
            taxId: (row.taxid ?? '').trim() || null,
            subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
            currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
          }

          await prisma.vendor.upsert({
            where: { vendorNumber },
            update: updateData,
            create: { ...updateData, vendorNumber },
          })
        }
      } else {
        // Create without vendorNumber - it will be auto-generated
        const updateData = {
          name,
          email: email || null,
          phone: (row.phone ?? '').trim() || null,
          address: (row.address ?? '').trim() || null,
          taxId: (row.taxid ?? '').trim() || null,
          subsidiaryId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
          currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
        }

        await prisma.vendor.create({
          data: updateData,
        })
      }
    }

    succeeded += 1
  }

  return succeeded
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const rawEntity = String(formData.get('entity') ?? '').toLowerCase()
    const mode = String(formData.get('mode') ?? 'addOrUpdate').toLowerCase() as ImportMode
    const dryRun = String(formData.get('dryRun') ?? 'true').toLowerCase() === 'true'
    const file = formData.get('file')

    if (!isSupportedEntity(rawEntity)) {
      return NextResponse.json({ error: 'Unsupported import entity.' }, { status: 400 })
    }
    const entity = rawEntity

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Only CSV and XLSX files are supported.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const rows = parseRows(file.name, bytes)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in file.' }, { status: 400 })
    }

    // Validate headers before processing
    const headerValidation = validateHeaders(rows, getRequiredHeaders(entity), entity)
    if (!headerValidation.valid) {
      return NextResponse.json({ error: headerValidation.error }, { status: 400 })
    }

    const errors: ImportError[] = []
    let succeeded = 0

    if (entity === 'currencies') {
      succeeded = await importCurrencies(rows, mode, dryRun, errors)
    } else if (entity === 'locations') {
      succeeded = await importLocations(rows, mode, dryRun, errors)
    } else if (entity === 'subsidiaries') {
      succeeded = await importSubsidiaries(rows, mode, dryRun, errors)
    } else if (entity === 'departments') {
      succeeded = await importDepartments(rows, mode, dryRun, errors)
    } else if (entity === 'items') {
      succeeded = await importItems(rows, mode, dryRun, errors)
    } else if (entity === 'employees') {
      succeeded = await importEmployees(rows, mode, dryRun, errors)
    } else if (entity === 'customers') {
      succeeded = await importCustomers(rows, mode, dryRun, errors)
    } else if (entity === 'contacts') {
      succeeded = await importContacts(rows, mode, dryRun, errors)
    } else if (entity === 'vendors') {
      succeeded = await importVendors(rows, mode, dryRun, errors)
    } else if (entity === 'chart-of-accounts') {
      succeeded = await importChartOfAccounts(rows, mode, dryRun, errors)
    }

    return NextResponse.json({
      entity,
      mode,
      dryRun,
      totalRows: rows.length,
      succeeded,
      failed: errors.length,
      errors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import master data.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
