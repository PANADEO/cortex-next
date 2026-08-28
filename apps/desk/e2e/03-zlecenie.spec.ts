import { test, expect, jako } from './osoby'
import type { Locator } from '@playwright/test'
import { dowodZeZdarzen } from '../src/core/dowod'

/** Nagłówek przebiegu przełącza, więc rozwijamy tylko wtedy, gdy naprawdę jest zwinięty. */
async function rozwin(naglowek: Locator) {
  if ((await naglowek.getAttribute('aria-expanded')) === 'false') await naglowek.click()
}

test.describe('Obszar 3 · Zlecam robotę, dostaję dokument z dowodem', () => {
  test('Karta zlecenia wstawia treść, nie wysyła', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/')
    await page.waitForSelector('button:has-text("Podpowiedzi"), button:has-text("Notatka ze spotkania")')
    const rozwin = page.getByRole('button', { name: 'Podpowiedzi', exact: true })
    if (await rozwin.count()) await rozwin.click()
    await page.getByRole('button', { name: /Notatka ze spotkania/ }).first().click()

    const pole = page.getByPlaceholder('Co mam dla Ciebie zrobić?')
    await expect(pole).toHaveValue(/notatk/i)
    // nic nie zostało wysłane: zostajemy na biurku, przycisk nadal zaprasza do wysłania
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.getByRole('button', { name: 'Zleć zadanie' })).toBeVisible()
  })

  test('Praca na pliku z biurka kończy się dokumentem z dowodem', async ({ page }) => {
    test.setTimeout(180_000)
    await jako(page, 'anna')
    await page.goto('/')
    await page.getByPlaceholder('Co mam dla Ciebie zrobić?').fill(
      'Przeczytaj Moje pliki/notatka-spotkanie.txt i zapisz z tego zwięzłą notatkę jako notatka.md, potem sprawdź plik po zapisie.',
    )
    await page.getByRole('button', { name: 'Zleć zadanie' }).click()
    await page.waitForURL(/\/sprawa\//)

    // przebieg mówi, co się dzieje, jeszcze zanim skończy
    const przebieg = page.getByRole('region', { name: 'Przebieg pracy' })
    await expect(przebieg).toBeVisible({ timeout: 120_000 })

    // po zakończeniu grupa zwija się do jednego zdania o wykonanej pracy
    const podsumowanie = przebieg.getByRole('button', { name: /przeczytałem 1 plik/i })
    await expect(podsumowanie).toBeVisible({ timeout: 120_000 })

    // wynik trafia do panelu obok, nie w środek historii
    await expect(page.getByText('notatka.md').first()).toBeVisible()
    await expect(page.getByText(/Dokument · .* zapisany/)).toBeVisible()

    // dowód jest dostępny po rozwinięciu przebiegu
    await rozwin(podsumowanie)
    await expect(przebieg.getByText('Sprawdzone:')).toBeVisible()
    await expect(przebieg.getByText(/To jest lista tego, co faktycznie się wydarzyło/)).toBeVisible()

    // Reguła rzeczownika: żaden wiersz przebiegu nie jest ogólny.
    const wiersze = przebieg.getByRole('list', { name: 'Kroki pracy' }).getByRole('button')
    const n = await wiersze.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const t = (await wiersze.nth(i).innerText()).trim()
      expect(t).not.toMatch(/^(Narzędzie|Tool)[: ]/)
      expect(t.length).toBeGreaterThan(10)
    }
  })

  test('Zakończony przebieg mówi w czasie przeszłym, nie „zapisuję" o czymś zapisanym', async ({ page }) => {
    test.setTimeout(180_000)
    await jako(page, 'anna')
    await page.goto('/')
    await page.getByPlaceholder('Co mam dla Ciebie zrobić?').fill(
      'Przeczytaj Moje pliki/notatka-spotkanie.txt i zapisz streszczenie jako streszczenie.md, potem sprawdź plik po zapisie.',
    )
    await page.getByRole('button', { name: 'Zleć zadanie' }).click()
    await page.waitForURL(/\/sprawa\//)

    const przebieg = page.getByRole('region', { name: 'Przebieg pracy' })
    const podsumowanie = przebieg.getByRole('button', { name: /zapisałem 1 dokument/i })
    await expect(podsumowanie).toBeVisible({ timeout: 120_000 })
    await rozwin(podsumowanie)
    const kroki = await przebieg.getByRole('list', { name: 'Kroki pracy' }).getByRole('button').allInnerTexts()
    expect(kroki.join(' ')).toMatch(/Przeczytałem|Zapisałem|Przejrzałem/)
    expect(kroki.join(' ')).not.toMatch(/Zapisuję|Czytam |Przeglądam/)
  })
})

test.describe('Reguła dowodu — dowód pochodzi ze zdarzeń, nie z opowieści modelu', () => {
  test('Zapisany dokument bez sprawdzenia trafia do „Nie sprawdzone"', () => {
    const d = dowodZeZdarzen([
      { typ: 'narzedzie_start', id: 'a', nazwa: 'czytaj_plik', etykieta: 'Czytam a.csv', argumenty: { sciezka: 'a.csv' } },
      { typ: 'narzedzie_koniec', id: 'a', nazwa: 'czytaj_plik', ok: true, podsumowanie: '10 wierszy', ms: 5 },
      { typ: 'narzedzie_start', id: 'b', nazwa: 'zapisz_dokument', etykieta: 'Zapisuję w.md', argumenty: { nazwa: 'w.md' } },
      { typ: 'narzedzie_koniec', id: 'b', nazwa: 'zapisz_dokument', ok: true, podsumowanie: '100 znaków', ms: 5 },
      { typ: 'assistant', tekst: 'Sprawdziłem wszystkie pola, wszystko się zgadza.' },
    ])
    expect(d.nieSprawdzone).toContain('zawartość pliku w.md po zapisie')
    expect(d.zrobione.join(' ')).not.toMatch(/sprawdzi/i)
  })

  test('Sprawdzony dokument nie trafia do „Nie sprawdzone"', () => {
    const d = dowodZeZdarzen([
      { typ: 'narzedzie_start', id: 'a', nazwa: 'czytaj_plik', etykieta: 'Czytam a.csv', argumenty: { sciezka: 'a.csv' } },
      { typ: 'narzedzie_koniec', id: 'a', nazwa: 'czytaj_plik', ok: true, podsumowanie: '10 wierszy', ms: 5 },
      { typ: 'narzedzie_start', id: 'b', nazwa: 'zapisz_dokument', etykieta: 'Zapisuję w.md', argumenty: { nazwa: 'w.md' } },
      { typ: 'narzedzie_koniec', id: 'b', nazwa: 'zapisz_dokument', ok: true, podsumowanie: '100 znaków', ms: 5 },
      { typ: 'narzedzie_start', id: 'c', nazwa: 'sprawdz_dokument', etykieta: 'Sprawdzam w.md', argumenty: { nazwa: 'w.md' } },
      { typ: 'narzedzie_koniec', id: 'c', nazwa: 'sprawdz_dokument', ok: true, podsumowanie: '0 pustych pól', ms: 5 },
    ])
    expect(d.nieSprawdzone).toHaveLength(0)
  })

  test('Przeplecione wywołania narzędzi parują się po identyfikatorze, nie po kolejności', () => {
    const d = dowodZeZdarzen([
      { typ: 'narzedzie_start', id: 'x', nazwa: 'czytaj_plik', etykieta: 'Czytam a.csv', argumenty: { sciezka: 'a.csv' } },
      { typ: 'narzedzie_start', id: 'y', nazwa: 'zapisz_dokument', etykieta: 'Zapisuję w.md', argumenty: { nazwa: 'w.md' } },
      // koniec przychodzi w odwrotnej kolejności — tak wygląda równoległe wywołanie narzędzi
      { typ: 'narzedzie_koniec', id: 'y', nazwa: 'zapisz_dokument', ok: false, podsumowanie: 'dysk pełny', ms: 5 },
      { typ: 'narzedzie_koniec', id: 'x', nazwa: 'czytaj_plik', ok: true, podsumowanie: '10 wierszy', ms: 5 },
    ])
    // nieudany zapis nie może przypisać sobie sukcesu odczytu
    expect(d.weszlo.join(' ')).toMatch(/a\.csv/)
    expect(d.zrobione.join(' ')).not.toMatch(/w\.md/)
  })
})

test.describe('Plakietka sprawdzenia mówi tylko to, co widać w zdarzeniach', () => {
  test('Obraz nie dostaje plakietki „sprawdzony" — nikt go po zapisie nie odczytał', async ({ page, request }) => {
    test.setTimeout(180_000)
    await jako(page, 'robert')
    const r = await request.post('/api/sprawa/nowa', {
      headers: { Cookie: 'desk_persona=robert' }, data: { tytul: 'Grafika' },
    })
    const { id } = await r.json()
    await request.post(`/api/sprawa/${id}/tura`, {
      headers: { Cookie: 'desk_persona=robert' },
      data: { tresc: 'Narysuj prostą ikonę oszczędności i zapisz jako ikona.png.' },
    })
    await page.goto(`/sprawa/${id}`)
    await expect(page.getByText('ikona.png').first()).toBeVisible({ timeout: 120_000 })
    // plik powstał, ale nikt go nie sprawdzał — więc żadna plakietka nie może twierdzić, że tak
    await expect(page.getByText('sprawdzony po zapisie')).toHaveCount(0)
  })
})
