#!/usr/bin/env node
// Quick seed script for Playwright tests
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { execSync } from 'child_process'

// Load .env.local manually
const env = readFileSync('/opt/prg/fastlane/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Simple bcrypt-compatible hash — we'll use the actual bcrypt via dynamic import
async function main() {
  // We need bcrypt — use execSync to hash
  const hash = execSync(
    `node -e "const b=require('bcryptjs');console.log(b.hashSync('testpass123',10))"`,
    { cwd: '/opt/prg/fastlane' }
  ).toString().trim()

  console.log('Password hash:', hash.substring(0, 20) + '...')

  const users = [
    { email: 'admin@test.com', password_hash: hash, role: 'admin', is_active: true },
    { email: 'agent@test.com', password_hash: hash, role: 'agent', is_active: true },
    { email: 'supervisor@test.com', password_hash: hash, role: 'supervisor', is_active: true },
  ]

  for (const user of users) {
    const { error } = await supabase.from('users').upsert(user, { onConflict: 'email' })
    if (error) console.error(`User ${user.email}:`, error.message)
    else console.log(`✓ User: ${user.email} (${user.role})`)
  }

  const { data: terminal, error: termErr } = await supabase
    .from('port_terminals')
    .upsert({ name: 'TEST-TERMINAL-A0', is_active: true }, { onConflict: 'name' })
    .select()
    .single()
  if (termErr) console.error('Terminal:', termErr.message)
  else console.log('✓ Terminal:', terminal?.name)

  const { error: compErr } = await supabase
    .from('truck_companies')
    .upsert({ name: 'Test Trucking Co', contact_email: 'test@trucking.com' }, { onConflict: 'contact_email' })
  if (compErr) console.error('Company:', compErr.message)
  else console.log('✓ Company: Test Trucking Co')

  console.log('\nSeed complete!')
}

main().catch(console.error)
