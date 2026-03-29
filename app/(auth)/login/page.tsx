'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      const role = data.user?.role
      const dest = redirect || (role === 'admin' ? '/users' : role === 'agent' ? '/bookings' : role === 'supervisor' ? '/capacity' : '/')
      window.location.href = dest
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="you@example.com"
          required
          autoComplete="email"
          data-testid="email-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          data-testid="password-input"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" data-testid="login-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
        data-testid="login-submit"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="text-center space-y-1">
        <Link href="/forgot-password" className="text-sm text-gray-500 hover:underline" data-testid="forgot-password-link">
          Forgot password?
        </Link>
        <p className="text-sm text-gray-500">
          Truck company?{' '}
          <Link href="/register/login" className="text-blue-600 hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Fastlane Management</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="card">
          <Suspense fallback={<div className="h-48 flex items-center justify-center text-gray-400">Loading…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
