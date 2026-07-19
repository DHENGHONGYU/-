import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './',
  testMatch: ['gray-test.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.DEPLOY_URL || 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
