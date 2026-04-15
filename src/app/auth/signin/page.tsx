'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'

const DEFAULT_SIGNIN_TIMEOUT_MS = 10000

function getSignInTimeoutMs() {
  const parsed = Number(process.env.NEXT_PUBLIC_AUTH_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SIGNIN_TIMEOUT_MS
}

async function signInWithTimeout(params: Parameters<typeof signIn>[1]) {
  const timeoutMs = getSignInTimeoutMs()

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Sign in request timed out')), timeoutMs)
  })

  const signInPromise = signIn('credentials', params)
  return Promise.race([signInPromise, timeoutPromise])
}

export default function SignIn() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SignInContent />
    </Suspense>
  )
}

function SignInContent() {
  const { status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const autoAttemptedRef = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  useEffect(() => {
    const autoSignInEnabled = process.env.NEXT_PUBLIC_AUTO_SIGN_IN === 'true'
    const autoEmail = process.env.NEXT_PUBLIC_AUTO_SIGN_IN_EMAIL
    const autoPassword = process.env.NEXT_PUBLIC_AUTO_SIGN_IN_PASSWORD

    if (!autoSignInEnabled || !autoEmail || !autoPassword || autoAttemptedRef.current) {
      return
    }

    autoAttemptedRef.current = true
    setEmail(autoEmail)
    setPassword(autoPassword)

    const attemptAutoSignIn = async () => {
      setIsSubmitting(true)
      setError('')

      try {
        const result = await signInWithTimeout({
          email: autoEmail,
          password: autoPassword,
          redirect: false,
          callbackUrl,
        })

        if (result?.error) {
          setError('Auto sign-in failed. Please sign in manually.')
          return
        }

        router.push(result?.url || callbackUrl)
      } catch {
        setError('Auto sign-in timed out. Please sign in manually.')
      } finally {
        setIsSubmitting(false)
      }
    }

    void attemptAutoSignIn()
  }, [callbackUrl, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await signInWithTimeout({
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError('Invalid credentials')
      } else {
        router.push(result?.url || callbackUrl)
      }
    } catch {
      setError('Sign in timed out. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to CRM/ERP
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}