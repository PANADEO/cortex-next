import { expect, test } from "@playwright/test"
import {
  expectNoConsoleErrors,
  installConsoleErrorTracker,
  mockAuth,
  mockBackendApi,
  mockClassificationFlag,
  screenshotPath,
  waitForHydrated,
} from "./helpers"

test.describe("issue #33: dashboard UX — sticky kanban headers, inline filters, search trigger", () => {
  test("filters are inline with H1 in PageHeader (single row)", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/dashboard")
    await waitForHydrated(page)

    const heading = page.getByRole("heading", { name: "Dashboard" })
    const counter = page.getByText(/\d+\s+on\s+board/).first()

    await expect(heading).toBeVisible()
    await expect(counter).toBeVisible()

    const headingBox = await heading.boundingBox()
    const counterBox = await counter.boundingBox()
    expect(headingBox).not.toBeNull()
    expect(counterBox).not.toBeNull()

    // Both elements should be vertically centered in the same row.
    const headingMid = (headingBox!.y) + headingBox!.height / 2
    const counterMid = (counterBox!.y) + counterBox!.height / 2
    expect(Math.abs(headingMid - counterMid)).toBeLessThanOrEqual(20)

    await page.screenshot({ path: screenshotPath("issue-33-inline-filters"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("search starts as icon-only trigger; clicking expands input; blur with empty value collapses", async ({
    page,
  }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/dashboard")
    await waitForHydrated(page)

    // Initially: icon-only "Open search" button, no input.
    const searchButton = page.getByRole("button", { name: /Open search/i })
    await expect(searchButton).toBeVisible()
    await expect(page.getByPlaceholder(/Search by name/i)).not.toBeVisible()
    await page.screenshot({
      path: screenshotPath("issue-33-search-collapsed-initial"),
      fullPage: true,
    })

    // Click expands.
    await searchButton.click()
    const searchInput = page.getByPlaceholder(/Search by name/i)
    await expect(searchInput).toBeVisible()
    await page.screenshot({ path: screenshotPath("issue-33-search-expanded"), fullPage: true })

    // Blur with empty value → collapses.
    await searchInput.blur()
    await page.waitForTimeout(150)
    await expect(searchButton).toBeVisible()
    await expect(page.getByPlaceholder(/Search by name/i)).not.toBeVisible()
    await page.screenshot({
      path: screenshotPath("issue-33-search-collapsed-after-blur"),
      fullPage: true,
    })

    expectNoConsoleErrors(tracker)
  })

  test("kanban column headers stay sticky when the column body scrolls", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/dashboard")
    await waitForHydrated(page)

    // Pick a column with enough cards to scroll. The DOM has multiple <section>
    // elements; we look for the first column whose card-container has overflow.
    const columnHeader = page.locator("section.overflow-hidden header").first()
    await expect(columnHeader).toBeVisible()
    const before = await columnHeader.boundingBox()
    expect(before).not.toBeNull()

    // Scroll the column's card container (the sibling div with overflow-y-auto)
    // and verify the header position is unchanged.
    await columnHeader.evaluate((header) => {
      const section = header.closest("section")
      const list = section?.querySelector('div.overflow-y-auto') as HTMLElement | null
      if (list) list.scrollBy({ top: 400, behavior: "instant" })
    })
    await page.waitForTimeout(150)

    const after = await columnHeader.boundingBox()
    expect(after).not.toBeNull()
    expect(Math.abs((after!.y) - (before!.y))).toBeLessThanOrEqual(5)

    await page.screenshot({ path: screenshotPath("issue-33-sticky-headers"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })
})
