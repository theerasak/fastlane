import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    env: {
      SUPABASE_URL: 'https://mock-supabase.test',
      SUPABASE_SERVICE_ROLE_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://mock-supabase.test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test',
      JWT_SECRET: 'test-jwt-secret-for-vitest-32chars!!',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      CRON_SECRET: 'test-cron-secret',
    },
  },
})
