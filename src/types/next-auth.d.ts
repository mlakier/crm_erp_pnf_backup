import type { Department } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

type SessionDepartment = Pick<Department, 'id' | 'name' | 'departmentId'> | null

declare module 'next-auth' {
  interface User {
    role?: string
    department?: SessionDepartment
  }

  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role?: string
      department?: SessionDepartment
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    department?: SessionDepartment
  }
}
