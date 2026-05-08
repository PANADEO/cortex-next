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

test.describe("issue #27: scroll scoped to active tab panel keeps context sticky", () => {
  test("scrolling the source-materials panel does not move header/status/actions/tablist", async ({
    page,
  }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto(`/idp/packages/${PACKAGE_ID}`)
    await waitForHydrated(page)

    // Open the Source materials tab — that's the long-content panel that
    // historically caused the parent to scroll and lose context.
    await page.getByRole("tab", { name: /Source materials/i }).click()
    await page.waitForTimeout(200)

    const header = page.getByRole("heading", { level: 1 }).first()
    const tabList = page.getByRole("tablist").first()
    // PackageStatusBadges is the row containing the badges — locate by the first badge.
    const statusRow = page.locator("section").first()

    await expect(header).toBeVisible()
    await expect(tabList).toBeVisible()
    await expect(statusRow).toBeVisible()

    const beforeHeader = await header.boundingBox()
    const beforeTabList = await tabList.boundingBox()
    const beforeStatus = await statusRow.boundingBox()

    expect(beforeHeader).not.toBeNull()
    expect(beforeTabList).not.toBeNull()
    expect(beforeStatus).not.toBeNull()

    // Scroll the active tab panel by 800px. Radix tabs uses [role=tabpanel]
    // with data-state="active" on the visible one.
    const activePanel = page.locator('[role="tabpanel"][data-state="active"]').first()
    await activePanel.evaluate((el) => {
      el.scrollBy({ top: 800, behavior: "instant" })
    })
    await page.waitForTimeout(200)

    const afterHeader = await header.boundingBox()
    const afterTabList = await tabList.boundingBox()
    const afterStatus = await statusRow.boundingBox()

    expect(afterHeader).not.toBeNull()
    expect(afterTabList).not.toBeNull()
    expect(afterStatus).not.toBeNull()

    const TOL = 5
    expect(Math.abs((afterHeader!.y) - (beforeHeader!.y))).toBeLessThanOrEqual(TOL)
    expect(Math.abs((afterTabList!.y) - (beforeTabList!.y))).toBeLessThanOrEqual(TOL)
    expect(Math.abs((afterStatus!.y) - (beforeStatus!.y))).toBeLessThanOrEqual(TOL)

    await page.screenshot({
      path: screenshotPath("issue-27-sticky-after-scroll"),
      fullPage: true,
    })
    expectNoConsoleErrors(tracker)
  })
})
