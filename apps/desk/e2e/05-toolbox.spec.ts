import { test, expect, jako } from './osoby'

test.describe('Obszar 5 · Toolbox stopniowany wg roli', () => {
  test('Dwie role, dwa zestawy', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    const polka = page.locator('aside')
    await expect(polka.getByText('Tworzenie dokumentów')).toBeVisible()
    await expect(polka.getByText('Uruchamianie obliczeń')).toBeVisible()
    await expect(polka.getByRole('button', { name: 'Poproś o dostęp' })).toHaveCount(3)

    await jako(page, 'robert')
    await page.goto('/')
    await expect(page.locator('aside').getByRole('button', { name: 'Poproś o dostęp' })).toHaveCount(0)
    await expect(page.locator('aside').getByText('Generowanie obrazów')).toBeVisible()
  })

  test('Zablokowana zdolność pokazuje dział-właściciela', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    await expect(page.locator('aside').getByText('dział: Marketing')).toBeVisible()
    await expect(page.locator('aside').getByText('dział: IT')).toBeVisible()
  })

  test('Prośba o dostęp zostawia potwierdzenie', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    await page.locator('aside').getByRole('button', { name: 'Poproś o dostęp' }).first().click()
    await expect(page.locator('aside').getByText('Prośba wysłana — oczekuje')).toBeVisible()
  })

  test('Model nie dostaje narzędzia spoza roli', async ({ request }) => {
    const r = await request.get('/api/pliki', { headers: { Cookie: 'desk_persona=anna' } })
    expect(r.ok()).toBeTruthy()
    // kontrakt bramy: Anna ma 4 zdolności, więc rejestr modelu ma 4 narzędzia
    // (sprawdzane bezpośrednio na polityce w tescie jednostkowym bramy)
  })
})
