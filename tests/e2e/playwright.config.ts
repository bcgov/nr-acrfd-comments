import { defineConfig, devices } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'path'

// Explicitly load .env from the same directory as this config file so that
// credentials are always available regardless of cwd or how Playwright is invoked.
loadDotenv({ path: resolve(__dirname, '.env') })

/**
 * In CI both vars are set to the same deployed host
 * (e.g. https://nr-acrfd-comments-42.apps.silver.devops.gov.bc.ca/).
 *
 * Locally the two apps run on different ports:
 *   E2E_ADMIN_BASE_URL=http://localhost:4200   (default)
 *   E2E_PUBLIC_BASE_URL=http://localhost:3000  (default)
 */

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'safari',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
