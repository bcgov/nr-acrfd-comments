import { test, expect } from '@playwright/test'
import { loginToAdmin } from '../helpers/admin-auth'

const ADMIN_BASE = (process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '')
const PUBLIC_BASE = (process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const TEST_DTID = '921528'

// Only run the lifecycle test against known writable environments.
// 'local' — auth bypassed, running against a local dev stack.
// 'dev'   — full Keycloak login, running against a PR/dev deployment.
// Anything else (test, prod, or unset) is a read-only or production environment
// where we must never create data.
const ALLOWED_ENVIRONMENTS = ['local', 'dev']
const currentEnv = process.env.E2E_ENVIRONMENT ?? ''

test.describe('Application lifecycle', () => {
  // Skip the entire suite when not in a writable environment.
  test.skip(
    !ALLOWED_ENVIRONMENTS.includes(currentEnv),
    `Lifecycle test skipped — E2E_ENVIRONMENT is "${currentEnv || 'unset'}". Must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}.`,
  )

  // Allow extra time for multi-step flow (Keycloak redirect + map rendering)
  test.setTimeout(60_000)

  test('create in admin then verify on public map', async ({ page }) => {
    // -------------------------------------------------------------------------
    // ADMIN — search for DTID 921528 and create the application
    // -------------------------------------------------------------------------

    await loginToAdmin(page)

    await page.goto(`${ADMIN_BASE}/admin`)

    // Search for the DTID
    await page.fill('#keywordInput', TEST_DTID)
    await page.click('button[type="submit"]')

    // Wait for the result row showing our DTID in the Disp. ID column
    const dtidCell = page.locator('td.disp strong', { hasText: TEST_DTID })
    await expect(dtidCell).toBeVisible({ timeout: 20_000 })

    // Click "Create" in that row (only present when the application is not yet created)
    const row = page.locator('tr.app-details', { has: dtidCell })
    await row.locator('button:has-text("Create")').click()

    // The Create button navigates to /a/0/edit with tantalisID query params
    await page.waitForURL(/\/admin\/a\/0\/edit/, { timeout: 15_000 })

    // Dates are pre-populated by the component — just add a description so the
    // form is identifiable and can be verified later if needed
    const description = `E2E test — DTID ${TEST_DTID} — ${new Date().toISOString()}`
    await page.fill('textarea[name="description"]', description)

    // Submit (Save button is only shown when !application._id, i.e. create mode)
    await page.click('button[title="Submit new application"]')

    // After saving the app is created and redirected to the detail page /a/{id}
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 20_000 })

    // Confirm we are on the right application
    const dispositionLabel = page.locator('.title-container__sub', {
      hasText: `Disposition Transaction: ${TEST_DTID}`,
    })
    await expect(dispositionLabel).toBeVisible()

    // Publish so the application appears on the public-facing map
    await page.click('button[title="Publish application"]')
    // Confirm the publish modal
    await page.locator('.modal-footer button', { hasText: 'OK' }).click()
    // The Publish button is replaced by the Unpublish button once published
    await expect(page.locator('button[title="Unpublish application"]')).toBeVisible({
      timeout: 10_000,
    })

    // -------------------------------------------------------------------------
    // PUBLIC — find the application on the map and check the details panel
    // -------------------------------------------------------------------------

    await page.goto(`${PUBLIC_BASE}`)

    // The public page opens with an intro modal containing a search input
    const introInput = page.locator('#introModalFind')
    await expect(introInput).toBeVisible({ timeout: 10_000 })
    await introInput.fill(TEST_DTID)

    // Submit the search from the intro modal
    await page.locator('button.gtm-splash-find').click()

    // After filtering, exactly one map marker should be visible
    const marker = page.locator('img.leaflet-marker-icon').first()
    await expect(marker).toBeVisible({ timeout: 20_000 })

    // Click the marker to open the Leaflet popup
    await marker.click()

    // Wait for the popup and click "View Application Details"
    const popupBtn = page.locator('.leaflet-popup-content button.app-link')
    await expect(popupBtn).toBeVisible({ timeout: 10_000 })
    await popupBtn.click()

    // The details panel now shows the selected application.
    // Find the "Disposition Transaction:" row in the metadata list.
    const dtidValueCell = page
      .locator('.meta-container li', {
        has: page.locator('.key', { hasText: 'Disposition Transaction:' }),
      })
      .locator('.value')

    await expect(dtidValueCell).toHaveText(TEST_DTID, { timeout: 10_000 })

    // -------------------------------------------------------------------------
    // ADMIN — navigate back, unpublish, then delete the application
    // -------------------------------------------------------------------------

    await page.goto(`${ADMIN_BASE}/admin`)

    // Search for the DTID again
    await page.fill('#keywordInput', TEST_DTID)
    await page.click('button[type="submit"]')

    // Wait for the result row and click through to the detail page
    const dtidCell2 = page.locator('td.disp strong', { hasText: TEST_DTID })
    await expect(dtidCell2).toBeVisible({ timeout: 20_000 })
    const row2 = page.locator('tr.app-details', { has: dtidCell2 })
    await row2.locator('button:has-text("Actions")').click()
    await row2.locator('button:has-text("View Application")').click()
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 15_000 })

    // Unpublish the application
    await page.click('button[title="Unpublish application"]')
    // The Unpublish button is replaced by the Publish button once unpublished
    await expect(page.locator('button[title="Publish application"]')).toBeVisible({
      timeout: 10_000,
    })

    // Delete the application
    await page.click('button[title="Remove this application from ACRFD"]')
    // Confirm the delete modal
    await page.locator('.modal-footer button', { hasText: 'OK' }).click()

    // After deletion we should be redirected back to the admin list
    await expect(page.locator('#keywordInput')).toBeVisible({ timeout: 15_000 })
  })
})
