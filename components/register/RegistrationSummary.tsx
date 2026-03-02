import { HOUR_LABELS } from '@/lib/constants'
import type { RegistrationResponse } from '@/types/api'

interface RegistrationSummaryProps {
  registrations: RegistrationResponse[]
  numTrucks: number
}

export function RegistrationSummary({ registrations, numTrucks }: RegistrationSummaryProps) {
  const active = registrations.filter(r => !r.is_deleted)
  const filled = active.length
  const pct = numTrucks > 0 ? Math.round((filled / numTrucks) * 100) : 0

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Registration Progress</h3>
        <span className="text-sm font-medium text-gray-600">{filled} / {numTrucks}</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${filled >= numTrucks ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {filled >= numTrucks && (
        <p className="text-sm text-green-700 font-medium">All trucks registered!</p>
      )}

      <div className="text-xs text-gray-500">
        {numTrucks - filled} slot(s) remaining
      </div>
    </div>
  )
}
