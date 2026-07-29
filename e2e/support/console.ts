// Generyczne (kafelek-agnostyczne) narzędzia do asercji "brak błędów w konsoli"
// i czekania na hydratację. Świadomie zduplikowane względem
// e2e/issue-66/helpers.ts, nie zaimportowane stamtąd — issue-66 to PO-ISSUE,
// legacy struktura (patrz .claude/skills/code-e2e/SKILL.md), nowa struktura
// (e2e/support, e2e/poms, e2e/fixtures) ma nie zależeć od niej. Gdy issue-66
// zostanie zmigrowane/wygaszone, ta duplikacja znika.

import { expect, type Page } from "@playwright/test"

const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [
  /^\[MSW\]/,
  /Download the React DevTools/,
  /<Suspense>/,
  /\[Fast Refresh\]/,
  /Failed to load resource: the server responded with a status of 404/,
  /Failed to load resource: the server responded with a status of 401/,
  /Failed to load resource: the server responded with a status of 403/,
  // Next.js dev SSR/CSR hydration mismatch — poza zakresem większości testów
  // treści; jeśli test dotyczy akurat hydratacji, usuń allowlistę lokalnie.
  /A tree hydrated but some attributes of the server rendered HTML didn't match/i,
  /Hydration failed because the initial UI does not match/i,
]

export interface ConsoleErrorTracker {
  errors: string[]
}

export function installConsoleErrorTracker(page: Page): ConsoleErrorTracker {
  const tracker: ConsoleErrorTracker = { errors: [] }

  page.on("console", (msg) => {
    if (msg.type() !== "error") return
    const text = msg.text()
    if (CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(text))) return
    tracker.errors.push(`[console.error] ${text}`)
  })

  page.on("pageerror", (err) => {
    tracker.errors.push(`[pageerror] ${err.message}`)
  })

  return tracker
}

export function expectNoConsoleErrors(tracker: ConsoleErrorTracker): void {
  expect(tracker.errors, `Unexpected console errors:\n${tracker.errors.join("\n")}`).toEqual([])
}

export async function waitForHydrated(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
}
