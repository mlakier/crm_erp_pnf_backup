import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getRequiredHeaders, isSupportedEntity, type SupportedEntity } from '@/lib/master-data-import-schema'

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
            symbol: symbol || null,
            decimals: parseNumber(decimalsStr, 2),
            isBase: parseBoolean(isBaseStr, false),
            active: parseBoolean(activeStr, true),
          },
          create: {
            code,
            name,
            symbol: symbol || null,
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
      const exists = await prisma.entity.findUnique({ where: { code } })
      
      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Subsidiary "${code}" already exists (add mode)` })
        continue
      }
      
      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Subsidiary "${code}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        await prisma.entity.upsert({
          where: { code },
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
            code,
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

async function importDepartments(rows: Array<Record<string, string>>, mode: ImportMode, dryRun: boolean, errors: ImportError[]) {
  let succeeded = 0

  const managerNumbers = Array.from(new Set(rows.map((row) => (row.manageremployeenumber ?? '').trim()).filter(Boolean)))
  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiarycode ?? '').toUpperCase()).filter(Boolean)))
  const managers = await prisma.employee.findMany({
    where: { employeeNumber: { in: managerNumbers } },
    select: { id: true, employeeNumber: true },
  })
  const subsidiaries = await prisma.entity.findMany({
    where: { code: { in: subsidiaryCodes } },
    select: { id: true, code: true },
  })
  const managerMap = new Map(managers.map((manager) => [manager.employeeNumber ?? '', manager.id]))
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.code.toUpperCase(), subsidiary.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const code = (row.code ?? '').toUpperCase()
    const name = row.name ?? ''
    const subsidiaryCode = (row.subsidiarycode ?? '').toUpperCase()
    const managerEmployeeNumber = (row.manageremployeenumber ?? '').trim()

    if (!code || !name) {
      if (!code) {
        errors.push({ row: rowNumber, message: 'code is required (cannot be empty)' })
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
        message: `managerEmployeeNumber "${managerEmployeeNumber}" not found (${count} employees available; examples: ${availableManagers || 'none'})`,
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
      const exists = await prisma.department.findUnique({ where: { code } })
      
      if (mode === 'add' && exists) {
        errors.push({ row: rowNumber, message: `Department "${code}" already exists (add mode)` })
        continue
      }
      
      if (mode === 'update' && !exists) {
        errors.push({ row: rowNumber, message: `Department "${code}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        await prisma.department.upsert({
          where: { code },
          update: {
            name,
            description: row.description || null,
            division: row.division || null,
            entityId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
            managerId: managerEmployeeNumber ? managerMap.get(managerEmployeeNumber) ?? null : null,
            active: parseBoolean(row.active, true),
          },
          create: {
            code,
            name,
            description: row.description || null,
            division: row.division || null,
            entityId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
            managerId: managerEmployeeNumber ? managerMap.get(managerEmployeeNumber) ?? null : null,
            active: parseBoolean(row.active, true),
          },
        })
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
    prisma.entity.findMany({ where: { code: { in: subsidiaryCodes } }, select: { id: true, code: true } }),
  ])

  const currencyMap = new Map(currencies.map((currency) => [currency.code.toUpperCase(), currency.id]))
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.code.toUpperCase(), subsidiary.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name ?? ''
    const itemNumber = (row.itemnumber ?? '').trim() || null
    const sku = (row.sku ?? '').trim() || null
    const currencyCode = (row.currencycode ?? '').toUpperCase()
    const subsidiaryCode = (row.subsidiarycode ?? '').toUpperCase()

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (!itemNumber && !sku) {
      errors.push({ row: rowNumber, message: 'itemNumber or sku is required for upsert key' })
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

    if (!dryRun) {
      // Check if record exists for mode validation
      let exists = false
      if (itemNumber) {
        const found = await prisma.item.findUnique({ where: { itemNumber } })
        exists = !!found
      } else if (sku) {
        const found = await prisma.item.findUnique({ where: { sku } })
        exists = !!found
      }

      if (mode === 'add' && exists) {
        const key = itemNumber || sku
        errors.push({ row: rowNumber, message: `Item "${key}" already exists (add mode)` })
        continue
      }

      if (mode === 'update' && !exists) {
        const key = itemNumber || sku
        errors.push({ row: rowNumber, message: `Item "${key}" does not exist (update mode)` })
        continue
      }

      if (mode === 'addOrUpdate' || (mode === 'add' && !exists) || (mode === 'update' && exists)) {
        const updateData = {
          name,
          description: row.description || null,
          itemType: row.itemtype || 'service',
          uom: row.uom || null,
          listPrice: parseNumber(row.listprice, 0),
          currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
          entityId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
          active: parseBoolean(row.active, true),
        }

        if (itemNumber) {
          await prisma.item.upsert({
            where: { itemNumber },
            update: { ...updateData, sku },
            create: { ...updateData, itemNumber, sku },
          })
        } else if (sku) {
          await prisma.item.upsert({
            where: { sku },
            update: { ...updateData, itemNumber },
            create: { ...updateData, itemNumber, sku },
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

  const departmentCodes = Array.from(new Set(rows.map((row) => (row.departmentcode ?? '').toUpperCase()).filter(Boolean)))
  const subsidiaryCodes = Array.from(new Set(rows.map((row) => (row.subsidiarycode ?? '').toUpperCase()).filter(Boolean)))
  const managerNumbers = Array.from(new Set(rows.map((row) => (row.manageremployeenumber ?? '').trim()).filter(Boolean)))

  const [departments, subsidiaries, managers] = await Promise.all([
    prisma.department.findMany({ where: { code: { in: departmentCodes } }, select: { id: true, code: true } }),
    prisma.entity.findMany({ where: { code: { in: subsidiaryCodes } }, select: { id: true, code: true } }),
    prisma.employee.findMany({ where: { employeeNumber: { in: managerNumbers } }, select: { id: true, employeeNumber: true } }),
  ])

  const departmentMap = new Map(departments.map((department) => [department.code.toUpperCase(), department.id]))
  const subsidiaryMap = new Map(subsidiaries.map((subsidiary) => [subsidiary.code.toUpperCase(), subsidiary.id]))
  const managerMap = new Map(managers.map((manager) => [manager.employeeNumber ?? '', manager.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const firstName = row.firstname ?? ''
    const lastName = row.lastname ?? ''
    const employeeNumber = (row.employeenumber ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const departmentCode = (row.departmentcode ?? '').toUpperCase()
    const subsidiaryCode = (row.subsidiarycode ?? '').toUpperCase()
    const managerEmployeeNumber = (row.manageremployeenumber ?? '').trim()

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

    if (subsidiaryCode && !subsidiaryMap.has(subsidiaryCode)) {
      const availableSubsidiaries = Array.from(subsidiaryMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `subsidiaryCode "${subsidiaryCode}" not found. Available: ${availableSubsidiaries || '(none - add subsidiaries first)'}`,
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
        message: `managerEmployeeNumber "${managerEmployeeNumber}" not found (${count} employees available; examples: ${availableManagers || 'none'})`,
      })
      continue
    }

    if (!dryRun) {
      // Check if record exists for mode validation
      let exists = false
      if (employeeNumber) {
        const found = await prisma.employee.findUnique({ where: { employeeNumber } })
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
        const updateData = {
          firstName,
          lastName,
          email,
          phone: (row.phone ?? '').trim() || null,
          title: (row.title ?? '').trim() || null,
          departmentId: departmentCode ? departmentMap.get(departmentCode) ?? null : null,
          entityId: subsidiaryCode ? subsidiaryMap.get(subsidiaryCode) ?? null : null,
          managerId: managerEmployeeNumber ? managerMap.get(managerEmployeeNumber) ?? null : null,
          active: parseBoolean(row.active, true),
        }

        if (employeeNumber) {
          await prisma.employee.upsert({
            where: { employeeNumber },
            update: updateData,
            create: { ...updateData, employeeNumber },
          })
        } else if (email) {
          await prisma.employee.upsert({
            where: { email },
            update: { ...updateData, employeeNumber },
            create: { ...updateData, employeeNumber },
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
    systemUser = await prisma.user.create({
      data: {
        email: 'system@import.local',
        name: 'System Import User',
        password: 'system', // dummy password
      },
    })
  }

  const entityCodes = Array.from(new Set(rows.map((row) => (row.entitycode ?? '').toUpperCase()).filter(Boolean)))
  const currencyCodes = Array.from(new Set(rows.map((row) => (row.currencycode ?? '').toUpperCase()).filter(Boolean)))

  const [entities, currencies] = await Promise.all([
    prisma.entity.findMany({ where: { code: { in: entityCodes } }, select: { id: true, code: true } }),
    prisma.currency.findMany({ where: { code: { in: currencyCodes } }, select: { id: true, code: true } }),
  ])

  const entityMap = new Map(entities.map((e) => [e.code.toUpperCase(), e.id]))
  const currencyMap = new Map(currencies.map((c) => [c.code.toUpperCase(), c.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name ?? ''
    const customerNumber = (row.customernumber ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const entityCode = (row.entitycode ?? '').toUpperCase()
    const currencyCode = (row.currencycode ?? '').toUpperCase().trim()

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (entityCode && !entityMap.has(entityCode)) {
      const availableEntities = Array.from(entityMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `entityCode "${entityCode}" not found. Available: ${availableEntities || '(none - add subsidiaries first)'}`,
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
        const found = await prisma.customer.findUnique({ where: { customerNumber } })
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
            entityId: entityCode ? entityMap.get(entityCode) ?? null : null,
            currencyId: currencyCode ? currencyMap.get(currencyCode) ?? null : null,
          }

          await prisma.customer.upsert({
            where: { customerNumber },
            update: updateData,
            create: { ...updateData, customerNumber, userId: systemUser.id },
          })
        }
      } else {
        // Create without customerNumber - it will be auto-generated
        const updateData = {
          name,
          email: email || null,
          phone: (row.phone ?? '').trim() || null,
          address: (row.address ?? '').trim() || null,
          industry: (row.industry ?? '').trim() || null,
          entityId: entityCode ? entityMap.get(entityCode) ?? null : null,
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
    systemUser = await prisma.user.create({
      data: {
        email: 'system@import.local',
        name: 'System Import User',
        password: 'system', // dummy password
      },
    })
  }

  const customerNumbers = Array.from(new Set(rows.map((row) => (row.customernumber ?? '').trim()).filter(Boolean)))
  const customers = await prisma.customer.findMany({
    where: { customerNumber: { in: customerNumbers } },
    select: { id: true, customerNumber: true },
  })
  const customerMap = new Map(customers.map((c) => [c.customerNumber ?? '', c.id]))

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

  const entityCodes = Array.from(new Set(rows.map((row) => (row.entitycode ?? '').toUpperCase()).filter(Boolean)))
  const currencyCodes = Array.from(new Set(rows.map((row) => (row.currencycode ?? '').toUpperCase()).filter(Boolean)))

  const [entities, currencies] = await Promise.all([
    prisma.entity.findMany({ where: { code: { in: entityCodes } }, select: { id: true, code: true } }),
    prisma.currency.findMany({ where: { code: { in: currencyCodes } }, select: { id: true, code: true } }),
  ])

  const entityMap = new Map(entities.map((e) => [e.code.toUpperCase(), e.id]))
  const currencyMap = new Map(currencies.map((c) => [c.code.toUpperCase(), c.id]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name ?? ''
    const vendorNumber = (row.vendornumber ?? '').trim() || null
    const email = (row.email ?? '').trim() || null
    const entityCode = (row.entitycode ?? '').toUpperCase()
    const currencyCode = (row.currencycode ?? '').toUpperCase()

    if (!name) {
      errors.push({ row: rowNumber, message: 'name is required (cannot be empty)' })
      continue
    }

    if (entityCode && !entityMap.has(entityCode)) {
      const availableEntities = Array.from(entityMap.keys()).join(', ')
      errors.push({
        row: rowNumber,
        message: `entityCode "${entityCode}" not found. Available: ${availableEntities || '(none - add subsidiaries first)'}`,
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
            entityId: entityCode ? entityMap.get(entityCode) ?? null : null,
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
          entityId: entityCode ? entityMap.get(entityCode) ?? null : null,
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
