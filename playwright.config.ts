import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against a running app (default: the local dev server).
//   npm run dev -- -p 3100   (in another terminal)   then   npm run e2e
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  // Generous: the dev server compiles pages on first visit, and from a local machine each database
  // round trip to Supabase (eu-west-1) takes ~0.6–1 s, so a busy admin page can take 20 s+ to render.
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
