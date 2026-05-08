import { expect, test } from "@playwright/test"
import {
  PACKAGE_ID,
  expectNoConsoleErrors,
  installConsoleErrorTracker,
  mockAuth,
  mockBackendApi,
  mockClassificationFlag,
  screenshotPath,
  waitForHydrated,
} from "./helpers"

test.describe("issue #40: action log rebuilt as Gmail-thread layout", () => {
  test("rows show edit summary inline; newest entry is expanded by default; older rows expand on click; filters and sort work", async ({
    page,
  }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto(`/idp/packages/${PACKAGE_ID}`)
    await waitForHydrated(page)

    await page.getByRole("tab", { name: /Action log/i }).click()
    await page.waitForTimeout(200)

    const rows = page.locator('details').filter({ has: page.locator("summary") })
    await expect(rows.first()).toBeVisible()
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)

    // Newest (first visible) row is expanded by default.
    const firstOpen = await rows.first().evaluate((el: HTMLDetailsElement) => el.open)
    expect(firstOpen).toBe(true)

    // Inline edit summary text matches /word: a → b/ — ActionLogTimeline renders
    // a font-mono preview with the literal "→" character separating from/to.
    const previewLine = page.locator('details span.font-mono').first()
    if (await previewLine.count()) {
      const previewText = await previewLine.textContent()
      // Either an edit-style row (with arrow) or a system row (no preview, count > 0 events overall).
      // We assert globally that at least one edit summary contains "→".
    }
    const arrowMatches = await page.locator('details span:has-text("→")').count()
    expect(arrowMatches).toBeGreaterThan(0)
    await page.screenshot({ path: screenshotPath("issue-40-default-view"), fullPage: true })

    // Click an older row (second row) — its <details open> should toggle to true.
    if (rowCount >= 2) {
      const secondRow = rows.nth(1)
      const wasOpen = await secondRow.evaluate((el: HTMLDetailsElement) => el.open)
      await secondRow.locator("summary").click()
      await page.waitForTimeout(100)
      const isOpen = await secondRow.evaluate((el: HTMLDetailsElement) => el.open)
      expect(isOpen).toBe(!wasOpen)
    }

    // Filter chips: click "System" → only system rows visible.
    await page.getByRole("button", { name: /^System\s*\d+$/i }).click()
    await page.waitForTimeout(150)
    // Each visible details row has an inline tag span. With System filter,
    // every visible row's tag should read "System".
    const visibleRows = page.locator("details:visible")
    const visibleCount = await visibleRows.count()
    if (visibleCount > 0) {
      const tags = await visibleRows.locator("span.uppercase").allTextContents()
      for (const t of tags) {
        expect(t.trim()).toBe("System")
      }
    }
    await page.screenshot({ path: screenshotPath("issue-40-filter-system"), fullPage: true })

    // Reset to All.
    await page.getByRole("button", { name: /^All\s*\d+$/i }).click()
    await page.waitForTimeout(100)

    // Sort: capture order of timestamps under "Newest first", switch to "Oldest first",
    // confirm order reverses.
    const newestTimes = await page.locator("details time").allTextContents()
    expect(newestTimes.length).toBeGreaterThan(1)

    // Open sort select and pick Oldest first.
    await page.locator('button[role="combobox"]', { hasText: /Newest first/i }).click()
    await page.getByRole("option", { name: /Oldest first/i }).click()
    await page.waitForTimeout(150)
    const oldestTimes = await page.locator("details time").allTextContents()
    expect(oldestTimes.length).toBe(newestTimes.length)
    // Compare first/last items rotated.
    expect(oldestTimes[0]).toBe(newestTimes[newestTimes.length - 1])

    // Restore Newest first for subsequent assertions.
    await page.locator('button[role="combobox"]', { hasText: /Oldest first/i }).click()
    await page.getByRole("option", { name: /Newest first/i }).click()
    await page.waitForTimeout(150)

    // Collapse all → 0 expanded.
    await page.getByRole("button", { name: /Collapse all/i }).click()
    await page.waitForTimeout(100)
    const expandedAfterCollapse = await page.locator("details[open]").count()
    expect(expandedAfterCollapse).toBe(0)

    // Expand all → all visible details expanded.
    await page.getByRole("button", { name: /Expand all/i }).click()
    await page.waitForTimeout(100)
    const totalDetails = await page.locator("details").count()
    const expandedAfterExpand = await page.locator("details[open]").count()
    expect(expandedAfterExpand).toBe(totalDetails)

    await page.screenshot({ path: screenshotPath("issue-40-expand-all"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })
})
