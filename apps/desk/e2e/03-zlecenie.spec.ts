import { test, expect, jako } from './osoby'
import { dowodZeZdarzen } from '../src/core/dowod'

test.describe('Obszar 3 · Zlecam robotę, dostaję dokument z dowodem', () => {
  test('Karta zlecenia wstawia treść, nie wysyła', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    await page.getByRole('button', { name: /Notatka ze spotkania/ }).click()
    const pole = page.getByPlaceholder('…albo po prostu napisz')
    await expect(pole).toHaveValue(/notatk/i)
    // nic nie zostało wysłane: zostajemy na biurku, przycisk nadal zaprasza do wysłania
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.getByRole('button', { name: 'Zleć' })).toBeVisible()
  })

  test('Praca na pliku z biurka kończy się dokumentem z dowodem', async ({ page }) => {
    test.setTimeout(180_000)
    await jako(page, 'anna')
    await page.goto('/')
    await page.getByPlaceholder('…albo po prostu napisz').fill(
      'Przeczytaj Moje pliki/notatka-spotkanie.txt i zapisz z tego zwięzłą notatkę jako notatka.md, potem sprawdź plik po zapisie.',
    )
    await page.getByRole('button', { name: 'Zleć' }).click()
    await page.waitForURL(/\/sprawa\//)

    await expect(page.getByText(/Czytam .*notatka-spotkanie\.txt/)).toBeVisible({ timeout: 120_000 })
    await expect(page.getByText('TECZKA SPRAWY')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByText('notatka.md', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Pokaż dowód' }).click()
    await expect(page.getByText('WESZŁO')).toBeVisible()
    await expect(page.getByText('ZROBIONE')).toBeVisible()

    // Reguła rzeczownika: żaden wiersz przebiegu nie jest ogólny.
    const wiersze = page.locator('button', { hasText: /Czytam|Zapisuję|Sprawdzam|Przeglądam/ })
    const n = await wiersze.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const t = (await wiersze.nth(i).innerText()).trim()
      expect(t).not.toMatch(/^(Narzędzie|Tool)[: ]/)
      expect(t.length).toBeGreaterThan(12)
    }
  })

})

test.describe('Reguła dowodu — dowód pochodzi ze zdarzeń, nie z opowieści modelu', () => {
  test('Zapisany dokument bez sprawdzenia trafia do „Nie sprawdzone"', () => {
    const d = dowodZeZdarzen([
      { typ: 'narzedzie_start', nazwa: 'czytaj_plik', etykieta: 'Czytam a.csv', argumenty: { sciezka: 'a.csv' } },
      { typ: 'narzedzie_koniec', nazwa: 'czytaj_plik', ok: true, podsumowanie: '10 wierszy', ms: 5 },
      { typ: 'narzedzie_start', nazwa: 'zapisz_dokument', etykieta: 'Zapisuję w.md', argumenty: { nazwa: 'w.md' } },
      { typ: 'narzedzie_koniec', nazwa: 'zapisz_dokument', ok: true, podsumowanie: '100 znaków', ms: 5 },
      { typ: 'assistant', tekst: 'Sprawdziłem wszystkie pola, wszystko się zgadza.' },
    ])
    expect(d.nieSprawdzone).toContain('zawartość pliku w.md po zapisie')
    expect(d.zrobione.join(' ')).not.toMatch(/sprawdzi/i)
  })

  test('Sprawdzony dokument nie trafia do „Nie sprawdzone"', () => {
    const d = dowodZeZdarzen([
      { typ: 'narzedzie_start', nazwa: 'czytaj_plik', etykieta: 'Czytam a.csv', argumenty: { sciezka: 'a.csv' } },
      { typ: 'narzedzie_koniec', nazwa: 'czytaj_plik', ok: true, podsumowanie: '10 wierszy', ms: 5 },
      { typ: 'narzedzie_start', nazwa: 'zapisz_dokument', etykieta: 'Zapisuję w.md', argumenty: { nazwa: 'w.md' } },
      { typ: 'narzedzie_koniec', nazwa: 'zapisz_dokument', ok: true, podsumowanie: '100 znaków', ms: 5 },
      { typ: 'narzedzie_start', nazwa: 'sprawdz_dokument', etykieta: 'Sprawdzam w.md', argumenty: { nazwa: 'w.md' } },
      { typ: 'narzedzie_koniec', nazwa: 'sprawdz_dokument', ok: true, podsumowanie: '0 pustych pól', ms: 5 },
    ])
    expect(d.nieSprawdzone).toHaveLength(0)
  })
})
