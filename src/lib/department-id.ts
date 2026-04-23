import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatDepartmentId(sequence: number, config = DEFAULT_ID_SETTINGS.department) {
  return formatIdentifier(sequence, config)
}

export async function generateNextDepartmentId() {
  const config = await loadIdSetting('department')
  const latestDepartments = await prisma.department.findMany({
    where: { departmentId: { startsWith: config.prefix } },
    orderBy: { departmentId: 'desc' },
    select: { departmentId: true },
    take: 200,
  })

  const nextSequence = getNextSequenceFromValues(
    latestDepartments.map((department) => department.departmentId),
    config,
  )

  return formatDepartmentId(nextSequence, config)
}
