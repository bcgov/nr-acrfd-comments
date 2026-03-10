import { test, expect } from '@playwright/test'
import { loginToAdmin } from '../helpers/admin-auth'
import { waitForServer } from '../helpers/wait-for-server'

const TITLE_TEXT = 'Applications, Comments'

// Strip any trailing slash so we can always append a known path cleanly.
const ADMIN_BASE = (process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '')
const PUBLIC_BASE = (process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

test.describe('Admin app smoke', () => {
  test.beforeAll(async () => {
    await waitForServer(`${ADMIN_BASE}/`)
  })

  test('loads and shows the site header', async ({ page }) => {
    await loginToAdmin(page)
    await page.goto(`${ADMIN_BASE}/admin/`)

    // The navbar brand title is present on every page of both apps
    const brand = page.locator('.navbar-brand__title')
    await expect(brand).toBeVisible()
    await expect(brand).toContainText(TITLE_TEXT)
  })
})

test.describe('Public app smoke', () => {
  test.beforeAll(async () => {
    await waitForServer(`${PUBLIC_BASE}/`)
  })

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

  test('use search with filters and check that data is loading', async ({ page }) => {
    await page.goto(`${PUBLIC_BASE}/`)

    // Close the intro/splash modal via its dedicated dismiss button
    const introModal = page.locator('app-splash-modal, .modal-content')
    await expect(introModal).toBeVisible({ timeout: 10_000 })
    await page.locator('button.gtm-splash-dismiss').click()
    await expect(introModal).not.toBeVisible({ timeout: 5_000 })

    // Click the "Explore" icon button in the left sidebar
    await page.locator('.side-nav button', { hasText: 'Explore' }).click()

    // Select "Commenting Closed" (cpStatus filter, id = NOT_OPEN)
    await page.locator('label[for="NOT_OPEN"]').click()

    // Select purpose filters by their checkbox ids (param values from PurposeCodes)
    for (const id of ['AGR', 'AQU', 'CMY', 'RES']) {
      await page.locator(`label[for="${id}"]`).click()
    }

    // Select "Decision Pending" application status (APPLICATION_REVIEW_COMPLETE.param = ARC)
    await page.locator('label[for="ARC"]').click()

    // Apply the filters — target the large-device button explicitly to avoid
    // clicking the hidden small-device duplicate that also carries gtm-apply-filters
    await page.locator('button.explore-btn-lg-device').click()

    // Brief pause to let the map settle before interacting with the marker
    await page.waitForTimeout(1_000)

    // Wait for at least one map marker to appear after filtering
    const marker = page.locator('img.leaflet-marker-icon').first()
    await expect(marker).toBeVisible({ timeout: 20_000 })

    // Click the first visible marker to open the Leaflet popup
    await marker.click()

    // Wait for the popup and click "View Application Details"
    const popupBtn = page.locator('.leaflet-popup-content button.app-link')
    await expect(popupBtn).toBeVisible({ timeout: 10_000 })
    await popupBtn.click()

    // Verify the details panel is populated — the Disposition Transaction field
    // must have a non-empty value, confirming data has loaded from the API
    const dtidValueCell = page
      .locator('.meta-container li', {
        has: page.locator('.key', { hasText: 'Disposition Transaction:' }),
      })
      .locator('.value')

    await expect(dtidValueCell).toBeVisible({ timeout: 10_000 })
    const dtidText = await dtidValueCell.textContent()
    expect(dtidText?.trim()).toBeTruthy()
  })
})
