import { test, expect, jako } from './osoby'

test.describe('Obszar 2 · Moje pliki — teczka, która przeżywa sprawę', () => {
  test('Wgrany plik zostaje na biurku i przeżywa przeładowanie', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    await page.locator('input[type=file]').setInputFiles({
      name: 'test-wgrany.txt', mimeType: 'text/plain', buffer: Buffer.from('treść testowa'),
    })
    await expect(page.getByText('test-wgrany.txt')).toBeVisible()
    await page.reload()
    await expect(page.getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Kasowanie jest odwracalne — plik trafia do kosza i wraca', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    const wiersz = page.locator('li', { hasText: 'test-wgrany.txt' })
    await wiersz.getByRole('button', { name: 'Usuń' }).click()
    await expect(page.getByText('test-wgrany.txt')).toHaveCount(0)
    await page.getByRole('button', { name: /Kosz/ }).click()
    await page.locator('li', { hasText: 'test-wgrany.txt' })
      .getByRole('button', { name: 'Przywróć' }).click()
    await expect(page.getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Pliki są prywatne', async ({ page }) => {
    await jako(page, 'robert')
    await page.goto('/pliki')
    await expect(page.getByText('test-wgrany.txt')).toHaveCount(0)
  })
})
