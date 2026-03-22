/**
 * Shifts a YYYY-MM-DD date string by the given number of days.
 * Uses Date.UTC to stay entirely in UTC and avoid timezone-offset bugs.
 */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().split('T')[0]
}
