// LCG Token Generator — Numerical Recipes parameters
// X(n+1) = (1664525n * Xn + 1013904223n) % 2n**32n
// Uses BigInt for precision, outputs 12-char base36 string

const LCG_A = 1664525n
const LCG_C = 1013904223n
const LCG_M = 2n ** 32n

function lcgStep(seed: bigint): bigint {
  return (LCG_A * seed + LCG_C) % LCG_M
}

/**
 * Generate a 12-char URL-safe base36 token from a UUID + timestamp seed.
 * Retries up to 10 times (incrementing timestamp) for uniqueness checks.
 */
export function generateLcgToken(bookingUuid: string, timestamp: number = Date.now()): string {
  // Seed: last 8 hex chars of UUID XOR low 32 bits of timestamp
  const uuidSuffix = bookingUuid.replace(/-/g, '').slice(-8)
  const uuidNum = parseInt(uuidSuffix, 16)
  const tsLow = timestamp & 0xffffffff

  let seed = BigInt(uuidNum ^ tsLow)

  // Run LCG several times to mix entropy
  seed = lcgStep(seed)
  seed = lcgStep(seed)
  seed = lcgStep(seed)

  // Combine two LCG outputs to get ~64 bits for 12-char base36
  const high = lcgStep(seed)
  const low = lcgStep(high)
  const combined = (high << 32n) | low

  // Convert to base36 string, zero-pad to 12 chars
  const token = combined.toString(36).padStart(12, '0').slice(-12)

  return token.toUpperCase()
}

/**
 * Generate a unique token, retrying up to maxRetries times.
 * The caller provides a uniqueness check function.
 */
export async function generateUniqueToken(
  bookingUuid: string,
  isUnique: (token: string) => Promise<boolean>,
  maxRetries = 10
): Promise<string> {
  let timestamp = Date.now()

  for (let i = 0; i < maxRetries; i++) {
    const token = generateLcgToken(bookingUuid, timestamp)
    if (await isUnique(token)) {
      return token
    }
    timestamp += 1
  }

  throw new Error('Failed to generate unique token after maximum retries')
}
