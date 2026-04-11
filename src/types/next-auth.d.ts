import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    role?: string
    department?: any
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string
      role?: string
      department?: any
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    department?: any
  }
}