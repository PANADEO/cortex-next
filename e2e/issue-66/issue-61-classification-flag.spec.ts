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

test.describe("issue #61: idp.classification feature flag gates the entire feature", () => {
  test("flag OFF: dashboard still renders; classification index 404s; classification workspace 404s", async ({
    page,
  }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/dashboard")
    await waitForHydrated(page)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await page.screenshot({
      path: screenshotPath("issue-61-flag-off-dashboard"),
      fullPage: true,
    })

    // /idp/classification → page calls notFound() once flagState.isPending settles.
    await page.goto("/idp/classification")
    await waitForHydrated(page)
    await expect(page.getByRole("heading", { name: /404|not found/i }).or(page.getByText(/404|not found/i)).first()).toBeVisible()
    await page.screenshot({
      path: screenshotPath("issue-61-flag-off-classification-index"),
      fullPage: true,
    })

    await page.goto(`/idp/classification/${PACKAGE_ID}`)
    await waitForHydrated(page)
    await expect(page.getByRole("heading", { name: /404|not found/i }).or(page.getByText(/404|not found/i)).first()).toBeVisible()
    await page.screenshot({
      path: screenshotPath("issue-61-flag-off-classification-workspace"),
      fullPage: true,
    })

    expectNoConsoleErrors(tracker)
  })

  test("flag ON: classification index renders the table", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, true)
    await mockBackendApi(page)

    await page.goto("/idp/classification")
    await waitForHydrated(page)
    await expect(page.getByRole("heading", { name: /Classification/i })).toBeVisible()

    await page.screenshot({
      path: screenshotPath("issue-61-flag-on-classification-index"),
      fullPage: true,
    })

    expectNoConsoleErrors(tracker)
  })
})
