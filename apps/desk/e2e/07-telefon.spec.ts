import { test, expect, jako } from './osoby'

test.use({ viewport: { width: 390, height: 844 } })

test.describe('Obszar 7 · Telefon', () => {
  test('Na telefonie ekranem głównym jest lista spraw, nie pole tekstowe', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Moje sprawy' })).toBeVisible()
    await expect(page.locator('aside')).toBeHidden()
  })

  test('Strona nie przewija się w poziomie', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    const przewijaSie = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(przewijaSie).toBe(false)
  })
})
