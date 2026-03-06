import { test, expect } from '@playwright/test'

const TITLE_TEXT = 'Applications, Comments'

// Strip any trailing slash so we can always append a known path cleanly.
const ADMIN_BASE = (process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '')
const PUBLIC_BASE = (process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

test.describe('Admin app smoke', () => {
  test('loads and shows the site header', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/admin/`)

    // The navbar brand title is present on every page of both apps
    const brand = page.locator('.navbar-brand__title')
    await expect(brand).toBeVisible()
    await expect(brand).toContainText(TITLE_TEXT)
  })
})

test.describe('Public app smoke', () => {
  test('loads and shows the site header', async ({ page }) => {
    await page.goto(`${PUBLIC_BASE}/`)

    const brand = page.locator('.navbar-brand__title')
    await expect(brand).toBeVisible()
    await expect(brand).toContainText(TITLE_TEXT)
  })

  test('shows the All Applications nav link', async ({ page }) => {
    await page.goto(`${PUBLIC_BASE}/`)

    // "All Applications" only exists in the public header, not the admin header
    const allApplicationsLink = page.locator('a.nav-link', { hasText: 'All Applications' })
    await expect(allApplicationsLink).toBeVisible()
  })
})
