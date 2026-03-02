import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key
// NEVER import this in client components
function createServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Singleton for server usage (avoids creating a new client on every request)
let _serverClient: ReturnType<typeof createServerClient> | null = null

export function getServerClient() {
  if (!_serverClient) {
    _serverClient = createServerClient()
  }
  return _serverClient
}

export { createServerClient }
