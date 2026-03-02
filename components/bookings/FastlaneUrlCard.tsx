'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface FastlaneUrlCardProps {
  token: string | null
  tokenCancelled: boolean
  bookingId: string
  onTokenGenerated: (token: string) => void
  onCancelled: () => void
}

export function FastlaneUrlCard({ token, tokenCancelled, bookingId, onTokenGenerated, onCancelled }: FastlaneUrlCardProps) {
  const [generating, setGenerating] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  const registrationUrl = token ? `${appUrl}/register/${token}` : null

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/generate-token`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to generate token', 'error'); return }
      onTokenGenerated(json.data.fastlane_token)
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
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleGenerate} loading={generating}>
              Regenerate
            </Button>
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
