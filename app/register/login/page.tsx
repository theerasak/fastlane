'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/register/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_email: email, password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Login failed'); return }
      router.push(nextUrl || '/')
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="company@email.com"
        required
        autoFocus
        data-testid="tc-email-input"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        data-testid="tc-password-input"
      />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" data-testid="tc-login-error">{error}</p>
      )}
      <Button type="submit" loading={loading} className="w-full" data-testid="tc-login-submit">
        Sign In
      </Button>
    </form>
  )
}

export default function TruckCompanyLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Truck Company Login</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to access your fastlane registration</p>
        </div>
        <div className="card">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
