'use client'

import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client using anon key (read-only public data)
// For most operations, use the server API routes instead

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabaseClient = createClient(url, anonKey)
