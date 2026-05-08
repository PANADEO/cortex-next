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

const ROUTES = [
  { name: "landing-anon", path: "/", authed: false },
  { name: "landing-authed", path: "/", authed: true },
  { name: "dashboard", path: "/idp/dashboard", authed: true },
  { name: "package-detail", path: `/idp/packages/${PACKAGE_ID}`, authed: true },
] as const

test.describe("issue #64: customer name 'Forsped' must not appear in any user-facing surface", () => {
  for (const route of ROUTES) {
    test(`${route.path} (${route.name}) does not render 'Forsped'`, async ({ page }) => {
      const tracker = installConsoleErrorTracker(page)
      await mockAuth(page, { authed: route.authed })
      await mockClassificationFlag(page, false)
      await mockBackendApi(page)

      await page.goto(route.path)
      await waitForHydrated(page)

      const body = page.locator("body")
      await expect(body).toBeVisible()
      await expect(body).not.toContainText(/Forsped/i)

      await page.screenshot({
        path: screenshotPath(`issue-64-no-forsped-${route.name}`),
        fullPage: true,
      })
      expectNoConsoleErrors(tracker)
    })
  }
})
