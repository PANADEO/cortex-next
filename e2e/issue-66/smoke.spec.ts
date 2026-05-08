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

const PACKAGE_TABS = [
  { slug: "transport", label: /Transport orders/i },
  { slug: "metadata", label: /^Metadata$/i },
  { slug: "analysis", label: /Analysis result/i },
  { slug: "ai-notifications", label: /AI notifications/i },
  { slug: "rules", label: /^Rules$/i },
  { slug: "actions", label: /Action log/i },
  { slug: "source", label: /Source materials/i },
] as const

test.describe("smoke: every key route renders without console errors", () => {
  test("/ anonymous (landing-anon)", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: false })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/")
    await waitForHydrated(page)

    await expect(page).toHaveTitle(/Cortex/i)
    await page.screenshot({ path: screenshotPath("smoke-landing-anon"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/ authenticated (landing-authed)", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/")
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("smoke-landing-authed"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/idp/dashboard", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/dashboard")
    await waitForHydrated(page)

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await page.screenshot({ path: screenshotPath("smoke-dashboard"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/idp/board", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/board")
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("smoke-board"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/idp/packages", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/packages")
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("smoke-packages"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/idp/packages/[id] base + 7 tabs", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto(`/idp/packages/${PACKAGE_ID}`)
    await waitForHydrated(page)
    await page.screenshot({ path: screenshotPath("smoke-package-detail"), fullPage: true })

    for (const tab of PACKAGE_TABS) {
      const trigger = page.getByRole("tab", { name: tab.label })
      // Tabs use Radix; click to switch.
      await trigger.click()
      await page.waitForTimeout(150)
      await page.screenshot({
        path: screenshotPath(`smoke-package-detail-tab-${tab.slug}`),
        fullPage: true,
      })
    }

    expectNoConsoleErrors(tracker)
  })

  test("/idp/import", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/import")
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("smoke-import"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/idp/audit-log", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/audit-log")
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("smoke-audit-log"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })

  test("/idp/verify/[id]", async ({ page }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto(`/idp/verify/${PACKAGE_ID}`)
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("smoke-verify"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })
})
