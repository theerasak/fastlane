'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface FastlaneUrlCardProps {
  token: string | null
  tokenCancelled: boolean
  tokenExpiresAt: string | null
  bookingId: string
  hasRegistrations: boolean
  onTokenGenerated: (token: string, expiresAt: string) => void
  onCancelled: () => void
}

export function FastlaneUrlCard({
  token,
  tokenCancelled,
  tokenExpiresAt,
  bookingId,
  hasRegistrations,
  onTokenGenerated,
  onCancelled,
}: FastlaneUrlCardProps) {
  const [generating, setGenerating] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  const registrationUrl = token ? `${appUrl}/register/${token}` : null

  const isExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < new Date() : false

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/generate-token`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to generate token', 'error'); return }
      onTokenGenerated(json.data.fastlane_token, json.data.token_expires_at)
      showToast('Token generated successfully', 'success')
    } catch { showToast('Network error', 'error') }
    finally { setGenerating(false) }
  }

  async function handleCancel() {
    if (!confirm('Cancel this fastlane URL? All truck registrations will be removed.')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
      if (!res.ok) { showToast('Failed to cancel', 'error'); return }
      onCancelled()
      showToast('Fastlane URL cancelled', 'success')
    } catch { showToast('Network error', 'error') }
    finally { setCancelling(false) }
  }

  function handleCopy() {
    if (!registrationUrl) return
    navigator.clipboard.writeText(registrationUrl)
    showToast('URL copied to clipboard', 'success')
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-gray-900">Fastlane Registration URL</h2>

      {tokenCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          This token has been cancelled.
        </div>
      )}

      {registrationUrl && !tokenCancelled ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono break-all" data-testid="registration-url">
              {registrationUrl}
            </code>
            <Button variant="secondary" size="sm" onClick={handleCopy}>Copy</Button>
          </div>

          {/* Expiry info */}
          {tokenExpiresAt && (
            isExpired ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700" data-testid="expiry-expired">
                This link expired on {new Date(tokenExpiresAt).toLocaleDateString()}.
              </div>
            ) : (
              <p className="text-xs text-gray-500" data-testid="expiry-date">
                Expires on {new Date(tokenExpiresAt).toLocaleDateString()}
              </p>
            )
          )}

          <div className="flex gap-2 flex-wrap">
            {hasRegistrations ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-full" data-testid="regen-blocked-msg">
                Cannot regenerate — this link has already been partially used.
              </p>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleGenerate} loading={generating} data-testid="regenerate-btn">
                Regenerate
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling} data-testid="cancel-token-btn">
              Cancel URL
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={handleGenerate} loading={generating} data-testid="generate-token-btn">
          Generate Registration URL
        </Button>
      )}
    </div>
  )
}
