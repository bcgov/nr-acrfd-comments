import { test, Page } from '@playwright/test'

const ADMIN_BASE = (process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '')

/**
 * Navigates to the admin app, performing a Keycloak login when required.
 *
 * Behaviour is controlled by E2E_ENVIRONMENT:
 *   local — authentication is assumed to be bypassed; navigates directly to the admin search page.
 *   dev   — performs the full Keycloak login flow using E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD.
 */
export async function loginToAdmin(page: Page): Promise<void> {
  const env = process.env.E2E_ENVIRONMENT ?? ''

  if (env === 'local') {
    // Auth is bypassed locally — navigate directly into the app.
    await page.goto(`${ADMIN_BASE}/admin`)
    return
  }

  const username = process.env.E2E_ADMIN_USERNAME ?? ''
  const password = process.env.E2E_ADMIN_PASSWORD ?? ''

  if (!username || !password) {
    test.skip(true, 'E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD must be set to run admin tests')
    return
  }

  await page.goto(`${ADMIN_BASE}/admin/`)

  // TODO - implement login

  // Wait for the redirect back to the admin app
  await page.waitForURL(`${ADMIN_BASE}/admin/**`, { timeout: 15_000 })
}
