# Fastlane Management System

Port fastlane booking management web app built with Next.js 14, Supabase, and TypeScript.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in the required environment variables:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
JWT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=...
```

## Development

```bash
npm run dev
```

## Testing

There are two test suites: **Vitest** (unit & integration) and **Playwright** (end-to-end).

### Unit Tests

```bash
npm run test:unit
```

Runs unit tests for JWT helpers, LCG token generator, and validation logic.

### Integration Tests

```bash
npm run test:integration
```

Runs API-level integration tests using MSW (Mock Service Worker) for auth, bookings, capacity, and registration endpoints.

### All Vitest Tests (unit + integration)

```bash
npm run test:vitest
```

### End-to-End Tests (Playwright)

Playwright tests run against a live dev server on `http://localhost:3000`. The server starts automatically if not already running.

```bash
npm run test:e2e
```

Run tests for a specific browser project:

```bash
npx playwright test --project="Desktop Chrome"
npx playwright test --project="7-inch Tablet"
npx playwright test --project="iPhone 12"
```

Run a specific test file:

```bash
npx playwright test tests/auth/login.spec.ts
npx playwright test tests/agent/bookings.spec.ts
npx playwright test tests/admin/admin.spec.ts
npx playwright test tests/supervisor/capacity.spec.ts
npx playwright test tests/register/registration.spec.ts
```

View the HTML report after a Playwright run:

```bash
npx playwright show-report
```

### All Tests

Run Vitest and Playwright together:

```bash
npm run test:vitest && npm run test:e2e
```

## Test Structure

```
tests/
├── unit/                  # Vitest unit tests
│   ├── jwt.test.ts
│   ├── lcg.test.ts
│   └── validations.test.ts
├── integration/           # Vitest integration tests (MSW)
│   ├── auth.test.ts
│   ├── bookings.test.ts
│   ├── capacity.test.ts
│   └── register.test.ts
├── auth/                  # Playwright e2e tests
├── admin/
├── agent/
├── supervisor/
├── register/
└── fixtures/              # Shared Playwright fixtures
```
