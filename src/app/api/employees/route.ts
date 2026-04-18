import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const employees = await (prisma as any).employee.findMany({
    where: { active: true },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
    orderBy: { lastName: 'asc' },
  })
  return NextResponse.json(employees)
}
