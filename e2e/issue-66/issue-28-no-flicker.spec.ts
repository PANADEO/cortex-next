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

test.describe("issue #28: dashboard auto-refresh is silent (no flicker)", () => {
  test.slow()

  test("the 'X on board' counter and filter row stay stable across polling intervals", async ({
    page,
  }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockAuth(page, { authed: true })
    await mockClassificationFlag(page, false)
    await mockBackendApi(page)

    await page.goto("/idp/dashboard")
    await waitForHydrated(page)

    await page.screenshot({ path: screenshotPath("issue-28-initial"), fullPage: true })

    // Counter text matches "<digits> on board".
    const counter = page.getByText(/\d+\s+on\s+board/).first()
    await expect(counter).toBeVisible()
    const initialText = (await counter.textContent())?.trim() ?? ""
    expect(initialText).toMatch(/^\d+\s+on\s+board$/)

    // Walk up to the filters row container; this snapshots the BoardFilters DOM
    // we expect to remain stable (no spinner re-injection, no aria-busy toggles).
    const filtersRow = counter.locator("xpath=ancestor::*[contains(@class,'ml-auto')]/parent::*").first()
    const initialOuterHtml = await filtersRow.evaluate((el) => el.outerHTML)

    // Watch DOM mutations on the filter row + counter for the polling window.
    // refetchInterval is 5s, so 12s observes at least 2 background refetches.
    const observation = await page.evaluate(
      ({ selector }) => {
        return new Promise<{
          ariaBusyToggled: boolean
          loaderAdded: boolean
          loadingTextSeen: boolean
        }>((resolve) => {
          const targets = document.querySelectorAll(selector)
          const target = targets[targets.length - 1] as HTMLElement | undefined
          if (!target) {
            resolve({ ariaBusyToggled: false, loaderAdded: false, loadingTextSeen: false })
            return
          }
          const result = {
            ariaBusyToggled: false,
            loaderAdded: false,
            loadingTextSeen: false,
          }
          const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.type === "attributes" && m.attributeName === "aria-busy") {
                result.ariaBusyToggled = true
              }
              if (m.type === "childList") {
                m.addedNodes.forEach((n) => {
                  if (!(n instanceof Element)) return
                  if (n.querySelector?.("svg.animate-spin") || n.matches?.("svg.animate-spin")) {
                    result.loaderAdded = true
                  }
                  if (/Loading…|Loading\.\.\./.test(n.textContent ?? "")) {
                    result.loadingTextSeen = true
                  }
                })
              }
            }
          })
          observer.observe(target, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["aria-busy"],
            characterData: true,
          })
          setTimeout(() => {
            observer.disconnect()
            resolve(result)
          }, 12_000)
        })
      },
      { selector: "[data-on-board-row], .ml-auto" },
    )

    expect(observation.ariaBusyToggled).toBe(false)
    expect(observation.loaderAdded).toBe(false)
    expect(observation.loadingTextSeen).toBe(false)

    // Outer HTML of the row should match (text content stable).
    const finalOuterHtml = await filtersRow.evaluate((el) => el.outerHTML)
    expect(finalOuterHtml).toBe(initialOuterHtml)

    const finalText = (await counter.textContent())?.trim() ?? ""
    expect(finalText).toBe(initialText)

    await page.screenshot({ path: screenshotPath("issue-28-after-polling"), fullPage: true })
    expectNoConsoleErrors(tracker)
  })
})
