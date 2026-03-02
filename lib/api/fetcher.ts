import { ApiError } from './errors'

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${res.status}`,
      res.status,
      data?.code || 'ERROR'
    )
  }

  return data as T
}
