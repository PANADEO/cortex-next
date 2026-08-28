import { test, expect, jako } from './osoby'
import type { Page } from '@playwright/test'

/** Nazwa pliku pojawia się też w tostach, więc asercje celują w samą listę. */
const lista = (page: Page) => page.getByRole('list', { name: 'Pliki w tym folderze' })

test.describe('Obszar 2 · Moje pliki — teczka, która przeżywa sprawę', () => {
  test('Wgrany plik zostaje na biurku i przeżywa przeładowanie', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'test-wgrany.txt', mimeType: 'text/plain', buffer: Buffer.from('treść testowa'),
    })
    await expect(lista(page).getByText('test-wgrany.txt')).toBeVisible()
    await page.reload()
    await expect(lista(page).getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Kasowanie jest odwracalne od razu — bez pytania, z przyciskiem Cofnij', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    await page.getByRole('button', { name: 'Więcej opcji dla test-wgrany.txt' }).first().click()
    await page.getByRole('menuitem', { name: /Usuń/ }).click()
    await expect(lista(page).getByText('test-wgrany.txt')).toHaveCount(0)
    await expect(page.getByText('Przeniesione do kosza: test-wgrany.txt')).toBeVisible()
    await page.getByRole('button', { name: 'Cofnij' }).click()
    await expect(lista(page).getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Skasowany plik można też odzyskać z kosza', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    await page.getByRole('button', { name: 'Więcej opcji dla test-wgrany.txt' }).first().click()
    await page.getByRole('menuitem', { name: /Usuń/ }).click()
    await expect(lista(page).getByText('test-wgrany.txt')).toHaveCount(0)
    await page.getByRole('button', { name: /^Kosz/ }).click()
    await page.locator('li', { hasText: 'test-wgrany.txt' })
      .getByRole('button', { name: 'Przywróć' }).first().click()
    await expect(lista(page).getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Zmiana nazwy dzieje się w wierszu, nie w okienku systemowym', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    await page.getByRole('button', { name: 'Więcej opcji dla test-wgrany.txt' }).first().click()
    await page.getByRole('menuitem', { name: /Zmień nazwę/ }).click()
    const pole = page.getByRole('textbox', { name: 'Nowa nazwa pliku' })
    await expect(pole).toBeVisible()
    await pole.fill('test-przemianowany.txt')
    await pole.press('Enter')
    await expect(lista(page).getByText('test-przemianowany.txt')).toBeVisible()
    // sprzątamy po sobie, żeby kolejne uruchomienie zastało to samo biurko
    await page.getByRole('button', { name: 'Więcej opcji dla test-przemianowany.txt' }).first().click()
    await page.getByRole('menuitem', { name: /Zmień nazwę/ }).click()
    const pole2 = page.getByRole('textbox', { name: 'Nowa nazwa pliku' })
    await pole2.fill('test-wgrany.txt')
    await pole2.press('Enter')
    await expect(lista(page).getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Nazwa zajęta nie kasuje cudzego pliku — zmiana jest odrzucana', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/pliki')
    await page.getByRole('button', { name: 'Więcej opcji dla test-wgrany.txt' }).first().click()
    await page.getByRole('menuitem', { name: /Zmień nazwę/ }).click()
    const pole = page.getByRole('textbox', { name: 'Nowa nazwa pliku' })
    await pole.fill('faktury-08.csv')
    await pole.press('Enter')
    await expect(page.getByText('Taki plik już tu jest. Wybierz inną nazwę.')).toBeVisible()
    await expect(lista(page).getByText('test-wgrany.txt')).toHaveCount(0)
    await pole.press('Escape')
    // oryginał ocalał
    await page.reload()
    await expect(lista(page).getByText('faktury-08.csv')).toBeVisible()
    await expect(lista(page).getByText('test-wgrany.txt')).toBeVisible()
  })

  test('Pliki są prywatne', async ({ page }) => {
    await jako(page, 'robert')
    await page.goto('/pliki')
    await expect(lista(page).getByText('test-wgrany.txt')).toHaveCount(0)
  })
})
