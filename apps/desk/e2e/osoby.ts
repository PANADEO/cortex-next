import { test as base, type Page } from '@playwright/test'

/** Wejście „jako kto" — jedyny sposób, w jaki testy poznają tożsamość. */
export async function jako(page: Page, kto: 'anna' | 'robert') {
  await page.context().addCookies([
    { name: 'desk_persona', value: kto, url: 'http://localhost:3210' },
  ])
}

export const test = base
export { expect } from '@playwright/test'
