import { test, expect, jako } from './osoby'

test.describe('Obszar 1 · To jest MOJE biurko', () => {
  test('Pierwsze wejście wita po imieniu i nie zostawia pustego pola', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Dzień dobry, Anna/ })).toBeVisible()
    await expect(page.getByText('Nikt inny go nie widzi')).toBeVisible()
    const karty = page.locator('button', { hasText: /dodaj|opisz/ })
    expect(await karty.count()).toBeGreaterThanOrEqual(3)
  })

  test('Sprawy są prywatne — Robert nie widzi spraw Anny', async ({ page, request }) => {
    await jako(page, 'anna')
    const r = await request.post('/api/sprawa/nowa', {
      headers: { Cookie: 'desk_persona=anna' },
      data: { tytul: 'Prywatna sprawa Anny' },
    })
    expect(r.ok()).toBeTruthy()
    await jako(page, 'robert')
    await page.goto('/')
    await expect(page.getByText('Prywatna sprawa Anny')).toHaveCount(0)
  })

  test('Cudzej sprawy nie da się otworzyć z adresu', async ({ page, request }) => {
    const r = await request.post('/api/sprawa/nowa', {
      headers: { Cookie: 'desk_persona=anna' },
      data: { tytul: 'Sprawa do podejrzenia' },
    })
    const { id } = await r.json()
    await jako(page, 'robert')
    await page.goto(`/sprawa/${id}`)
    await expect(page.getByText('To nie jest Twoja sprawa')).toBeVisible()
  })
})
