import { test, expect } from '@playwright/test'
import { loginToAdmin } from '../helpers/admin-auth'
import { waitForServer } from '../helpers/wait-for-server'

const ADMIN_BASE = (process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '')
const PUBLIC_BASE = (process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// DTID used for the application create/verify/delete lifecycle
const LIFECYCLE_DTID = '921527'

// DTID used for the comment flow — a pre-existing published application that has an open comment period.
const COMMENT_DTID = '921528'

// Only run the lifecycle tests against local and dev as they create / edit data
const ALLOWED_ENVIRONMENTS = ['local', 'dev']
const currentEnv = process.env.E2E_ENVIRONMENT ?? ''

test.describe('Application lifecycle', () => {
  test.beforeAll(async () => {
    await waitForServer(`${ADMIN_BASE}/`)
    await waitForServer(`${PUBLIC_BASE}/`)
  })

  test.skip(
    !ALLOWED_ENVIRONMENTS.includes(currentEnv),
    `Lifecycle test skipped — E2E_ENVIRONMENT is "${currentEnv || 'unset'}". Must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}.`,
  )

  test.skip(
    currentEnv !== 'local' && (!process.env.E2E_ADMIN_USERNAME || !process.env.E2E_ADMIN_PASSWORD),
    'Lifecycle test skipped — E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD must be set for non-local environments.',
  )

  test.setTimeout(60_000)

  // ---------------------------------------------------------------------------
  // TEST 1 — Create in admin, verify on public map, then delete
  // Uses DTID 921529.  No comments are submitted so the application can be
  // fully cleaned up at the end of the test.
  // ---------------------------------------------------------------------------
  test('create in admin, verify on public map, then delete', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium only test')

    // -------------------------------------------------------------------------
    // ADMIN — search for DTID and create the application
    // -------------------------------------------------------------------------

    await loginToAdmin(page)

    await page.goto(`${ADMIN_BASE}/admin`)

    // Search for the DTID
    await page.fill('#keywordInput', LIFECYCLE_DTID)
    await page.click('button[type="submit"]')

    // Wait for the result row showing our DTID in the Disp. ID column
    const dtidCell = page.locator('td.disp strong', { hasText: LIFECYCLE_DTID })
    await expect(dtidCell).toBeVisible({ timeout: 20_000 })

    // Click "Create" in that row (only present when the application is not yet created)
    const row = page.locator('tr.app-details', { has: dtidCell })
    await row.locator('button:has-text("Create")').click()

    // The Create button navigates to /a/0/edit with tantalisID query params
    await page.waitForURL(/\/admin\/a\/0\/edit/, { timeout: 15_000 })

    // Dates are pre-populated by the component — just add a description so the
    // form is identifiable and can be verified later if needed
    const description = `E2E test — DTID ${LIFECYCLE_DTID} — ${new Date().toISOString()}`
    await page.fill('textarea[name="description"]', description)

    // Submit (Save button is only shown when !application._id, i.e. create mode)
    await page.click('button[title="Submit new application"]')

    // After saving the app is created and redirected to the detail page /a/{id}
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 20_000 })

    // Confirm we are on the right application
    const dispositionLabel = page.locator('.title-container__sub', {
      hasText: `Disposition Transaction: ${LIFECYCLE_DTID}`,
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
    await introInput.fill(LIFECYCLE_DTID)

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

    await expect(dtidValueCell).toHaveText(LIFECYCLE_DTID, { timeout: 10_000 })

    // -------------------------------------------------------------------------
    // ADMIN — navigate back, unpublish, then delete the application
    // -------------------------------------------------------------------------

    await page.goto(`${ADMIN_BASE}/admin`)

    // Search for the DTID again
    await page.fill('#keywordInput', LIFECYCLE_DTID)
    await page.click('button[type="submit"]')

    // Wait for the result row and click through to the detail page
    const dtidCell2 = page.locator('td.disp strong', { hasText: LIFECYCLE_DTID })
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

  // ---------------------------------------------------------------------------
  // TEST 2 — Submit a comment on the public site then verify it in admin
  // Uses DTID 921528 (pre-existing published application with an open comment
  // period).  The application is intentionally not deleted because an
  // application with submitted comments cannot be removed.
  // ---------------------------------------------------------------------------
  test('submit a comment on public site then verify in admin', async ({ page }) => {
    // -------------------------------------------------------------------------
    // ADMIN — record the initial comment count before submitting anything
    // -------------------------------------------------------------------------

    await loginToAdmin(page)

    await page.goto(`${ADMIN_BASE}/admin`)

    await page.fill('#keywordInput', COMMENT_DTID)
    await page.click('button[type="submit"]')

    const dtidCellInitial = page.locator('td.disp strong', { hasText: COMMENT_DTID })
    await expect(dtidCellInitial).toBeVisible({ timeout: 20_000 })
    const rowInitial = page.locator('tr.app-details', { has: dtidCellInitial })
    await rowInitial.locator('button:has-text("Actions")').click()
    await rowInitial.locator('button:has-text("View Application")').click()
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 15_000 })

    const reviewCommentsBtnInitial = page.locator('button[title="Review comments"]')
    await expect(reviewCommentsBtnInitial).toBeVisible({ timeout: 10_000 })
    const initialBtnText = await reviewCommentsBtnInitial.textContent()
    const initialCountMatch = initialBtnText?.match(/\((\d+)\)/)
    const initialCount = initialCountMatch ? parseInt(initialCountMatch[1], 10) : 0

    // -------------------------------------------------------------------------
    // PUBLIC — find the application on the map and submit a comment
    // -------------------------------------------------------------------------

    await page.goto(`${PUBLIC_BASE}`)

    // The public page opens with an intro modal containing a search input
    const introInput = page.locator('#introModalFind')
    await expect(introInput).toBeVisible({ timeout: 10_000 })
    await introInput.fill(COMMENT_DTID)

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

    // Confirm we are looking at the correct application
    const dtidValueCell = page
      .locator('.meta-container li', {
        has: page.locator('.key', { hasText: 'Disposition Transaction:' }),
      })
      .locator('.value')

    await expect(dtidValueCell).toHaveText(COMMENT_DTID, { timeout: 10_000 })

    // Submit a comment (button is visible only when the comment period is open)
    const submitCommentBtn = page.locator('button.submit-comment-btn')
    await expect(submitCommentBtn).toBeVisible({ timeout: 10_000 })
    await submitCommentBtn.click()

    // Page 1: accept terms & conditions
    await page.check('#iAgree')
    await page.locator('.modal-footer button.btn-primary').click()

    // Page 2: skip optional contact info
    await page.locator('.modal-footer button.btn-primary').click()

    // Page 3: enter comment text and submit
    await page.fill(
      'textarea#comment',
      `E2E test comment — DTID ${COMMENT_DTID} — ${new Date().toISOString()}`,
    )
    await page.click('button.gtm-submit-comment-submit')

    // Page 4: close the thank-you confirmation
    await page.click('button.gtm-submit-comment-done')

    // -------------------------------------------------------------------------
    // ADMIN — verify the comment count has increased by 1
    // -------------------------------------------------------------------------

    await loginToAdmin(page)

    await page.goto(`${ADMIN_BASE}/admin`)

    // Search for the DTID
    await page.fill('#keywordInput', COMMENT_DTID)
    await page.click('button[type="submit"]')

    // Wait for the result row and click through to the detail page
    const dtidCell = page.locator('td.disp strong', { hasText: COMMENT_DTID })
    await expect(dtidCell).toBeVisible({ timeout: 20_000 })
    const row = page.locator('tr.app-details', { has: dtidCell })
    await row.locator('button:has-text("Actions")').click()
    await row.locator('button:has-text("View Application")').click()
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 15_000 })

    // The "Review Comments" button shows the live comment count — verify it
    // is greater than the count recorded before the comment was submitted.
    // We don't assert an exact increment because parallel browser runs may have
    // each added their own comment concurrently.
    const reviewCommentsBtn = page.locator('button[title="Review comments"]')
    await expect(reviewCommentsBtn).toBeVisible({ timeout: 10_000 })
    const finalBtnText = await reviewCommentsBtn.textContent()
    const finalCountMatch = finalBtnText?.match(/\((\d+)\)/)
    const finalCount = finalCountMatch ? parseInt(finalCountMatch[1], 10) : 0
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  // ---------------------------------------------------------------------------
  // TEST 3 — Edit the description of the 921528 application in admin
  // ---------------------------------------------------------------------------
  test('edit application description in admin', async ({ page }) => {
    await loginToAdmin(page)

    await page.goto(`${ADMIN_BASE}/admin`)

    await page.fill('#keywordInput', COMMENT_DTID)
    await page.click('button[type="submit"]')

    const dtidCell = page.locator('td.disp strong', { hasText: COMMENT_DTID })
    await expect(dtidCell).toBeVisible({ timeout: 20_000 })
    const row = page.locator('tr.app-details', { has: dtidCell })
    await row.locator('button:has-text("Actions")').click()
    await row.locator('button:has-text("View Application")').click()
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 15_000 })

    // Navigate to the edit page for this application
    await page.click('button[title="Edit application"]')
    await page.waitForURL(/\/admin\/a\/[^/]+\/edit$/, { timeout: 15_000 })

    // Record the original description before making any changes
    const descriptionTextarea = page.locator('textarea[name="description"]')
    await expect(descriptionTextarea).toBeVisible({ timeout: 5_000 })
    const originalDescription = await descriptionTextarea.inputValue()

    // Replace the description with a timestamped value
    const newDescription = `E2E edited description — DTID ${COMMENT_DTID} — ${new Date().toISOString()}`
    await page.fill('textarea[name="description"]', newDescription)

    // The save button title differs depending on whether the app is published
    const saveBtn = page.locator(
      'button[title="Save application"], button[title="Publish changes"]',
    )
    await expect(saveBtn).toBeVisible({ timeout: 5_000 })
    await saveBtn.click()

    // After saving we are redirected back to the detail page
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 20_000 })

    // Check that the description has changed
    const descriptionEl = page
      .locator('section', { has: page.locator('h2', { hasText: 'Description' }) })
      .locator('p.mb-0')
    await expect(descriptionEl).not.toHaveText(originalDescription, { timeout: 10_000 })
  })

  // ---------------------------------------------------------------------------
  // TEST 4 — Export comments for 921528 to Excel and verify the file is non-empty
  // ---------------------------------------------------------------------------
  test('export comments to Excel from review-comments page', async ({ page }) => {
    await loginToAdmin(page)

    await page.goto(`${ADMIN_BASE}/admin`)

    await page.fill('#keywordInput', COMMENT_DTID)
    await page.click('button[type="submit"]')

    const dtidCell = page.locator('td.disp strong', { hasText: COMMENT_DTID })
    await expect(dtidCell).toBeVisible({ timeout: 20_000 })
    const row = page.locator('tr.app-details', { has: dtidCell })
    await row.locator('button:has-text("Actions")').click()
    await row.locator('button:has-text("View Application")').click()
    await page.waitForURL(/\/admin\/a\/(?!0)[^/]+$/, { timeout: 15_000 })

    // Navigate to the review-comments page via the "Review Comments" button
    const reviewCommentsBtn = page.locator('button[title="Review comments"]')
    await expect(reviewCommentsBtn).toBeVisible({ timeout: 10_000 })
    await reviewCommentsBtn.click()
    await page.waitForURL(/\/admin\/comments\/[^/]+$/, { timeout: 15_000 })

    // The Export to Excel button is disabled when there are no comments — wait
    // for it to become enabled, which confirms comments have loaded
    const exportBtn = page.locator('button', { hasText: 'Export to Excel' })
    await expect(exportBtn).toBeEnabled({ timeout: 15_000 })

    // Trigger the download and capture it
    const [download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()])

    // Stream the file and verify it is non-empty
    const stream = await download.createReadStream()
    const size = await new Promise<number>((resolve, reject) => {
      let bytes = 0
      stream.on('data', (chunk: Buffer) => {
        bytes += chunk.length
      })
      stream.on('end', () => resolve(bytes))
      stream.on('error', reject)
    })

    expect(size).toBeGreaterThan(0)
  })
})
