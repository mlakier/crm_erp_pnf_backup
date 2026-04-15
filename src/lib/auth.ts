import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'

const DEFAULT_AUTH_TIMEOUT_MS = 8000

function getAuthTimeoutMs() {
  const parsed = Number(process.env.AUTH_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AUTH_TIMEOUT_MS
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Auth operation timed out'))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const timeoutMs = getAuthTimeoutMs()

        try {
          const user = await withTimeout(
            prisma.user.findUnique({
              where: { email: credentials.email as string },
              include: { department: true, role: true },
            }),
            timeoutMs,
          )

          if (!user) {
            return null
          }

          const isPasswordValid = await withTimeout(compare(credentials.password as string, user.password), timeoutMs)

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role?.name ?? 'user',
            department: user.department,
          }
        } catch (error) {
          console.error('Credentials authorize failed', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.department = user.department
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub ?? session.user.id
        session.user.role = token.role as string
        session.user.department = token.department as any
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
}
