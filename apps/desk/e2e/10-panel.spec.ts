import { test, expect, jako } from './osoby'
import { obietniceBezPokrycia, wytworzone } from '@cortex/desk-core/obietnice'
import { podzielTeczke } from '@cortex/desk-core/teczka'
import { czytelnyBlad } from '@cortex/desk-core/awaria'
import type { DeskEvent, PlikMeta } from '@cortex/desk-core/typy'

const CIASTKO = (kto: string) => ({ Cookie: `desk_persona=${kto}` })

async function nowaSprawa(request: any, kto: string, tytul: string) {
  const r = await request.post('/api/sprawa/nowa', { headers: CIASTKO(kto), data: { tytul } })
  return (await r.json()).id as string
}

const panelu = (page: any) => page.getByRole('complementary', { name: 'Panel wyniku' })
const uchwytu = (page: any) => page.getByRole('separator', { name: 'Szerokość panelu wyniku' })

async function szerokoscPanelu(page: any) {
  const b = await panelu(page).boundingBox()
  return b?.width ?? 0
}

test.describe('Obszar 13 · Panel wyniku słucha ręki', () => {
  test('Przeciągnięcie uchwytu w lewo poszerza panel', async ({ page, request }) => {
    await jako(page, 'anna')
    const id = await nowaSprawa(request, 'anna', 'Szerokość')
    await page.goto(`/sprawa/${id}`)

    const przed = await szerokoscPanelu(page)
    const u = await uchwytu(page).boundingBox()
    expect(u).toBeTruthy()

    await page.mouse.move(u!.x + u!.width / 2, u!.y + 200)
    await page.mouse.down()
    await page.mouse.move(u!.x - 150, u!.y + 200, { steps: 12 })
    await page.mouse.up()

    const po = await szerokoscPanelu(page)
    expect(po).toBeGreaterThan(przed + 100)
  })

  test('Dociągnięcie uchwytu do prawej krawędzi zwija panel', async ({ page, request }) => {
    await jako(page, 'anna')
    const id = await nowaSprawa(request, 'anna', 'Zwijanie')
    await page.goto(`/sprawa/${id}`)
    await expect(panelu(page)).toBeVisible()

    const u = await uchwytu(page).boundingBox()
    await page.mouse.move(u!.x + u!.width / 2, u!.y + 200)
    await page.mouse.down()
    await page.mouse.move(page.viewportSize()!.width - 4, u!.y + 200, { steps: 12 })
    await page.mouse.up()

    await expect(panelu(page)).toBeHidden()
    // zwinięty panel musi dać się przywrócić — inaczej to nie zwinięcie, tylko utrata
    await page.getByRole('button', { name: 'Pokaż panel wyniku' }).click()
    await expect(panelu(page)).toBeVisible()
  })

  test('Ustawiona szerokość przeżywa przeładowanie strony', async ({ page, request }) => {
    await jako(page, 'anna')
    const id = await nowaSprawa(request, 'anna', 'Trwała szerokość')
    await page.goto(`/sprawa/${id}`)

    const u = await uchwytu(page).boundingBox()
    await page.mouse.move(u!.x + u!.width / 2, u!.y + 200)
    await page.mouse.down()
    await page.mouse.move(u!.x - 180, u!.y + 200, { steps: 12 })
    await page.mouse.up()
    const ustawiona = await szerokoscPanelu(page)

    await page.reload()
    await expect(panelu(page)).toBeVisible()
    expect(Math.abs((await szerokoscPanelu(page)) - ustawiona)).toBeLessThan(8)
  })

  test('Uchwyt da się obsłużyć z klawiatury', async ({ page, request }) => {
    await jako(page, 'anna')
    const id = await nowaSprawa(request, 'anna', 'Klawiatura')
    await page.goto(`/sprawa/${id}`)

    const przed = await szerokoscPanelu(page)
    await uchwytu(page).focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    expect(await szerokoscPanelu(page)).toBeGreaterThan(przed + 40)
  })
})

test.describe('Obszar 14 · To, co powstało, widać w rozmowie', () => {
  test('Zapisany dokument dostaje kartę w rozmowie, a kliknięcie otwiera go w panelu', async ({ page, request }) => {
    test.setTimeout(180_000)
    await jako(page, 'anna')
    const id = await nowaSprawa(request, 'anna', 'Karta dokumentu')
    await request.post(`/api/sprawa/${id}/tura`, {
      headers: CIASTKO('anna'),
      data: { tresc: 'Zapisz plik notatka.md z jednym zdaniem o kotach.' },
    })
    await page.goto(`/sprawa/${id}`)

    const karta = page.getByRole('button', { name: 'Otwórz notatka.md' })
    await expect(karta).toBeVisible({ timeout: 120_000 })
    await expect(karta).toContainText('Dokument')

    // panel pokazuje ten sam plik dopiero po kliknięciu w kartę — a nie w nowej karcie przeglądarki
    const stron = page.context().pages().length
    await karta.click()
    expect(page.context().pages().length).toBe(stron)
    await expect(panelu(page).getByText('notatka.md').first()).toBeVisible()
  })

  test('Wygenerowany obraz widać w rozmowie, nie tylko w panelu z boku', async ({ page, request }) => {
    test.setTimeout(180_000)
    await jako(page, 'robert')
    const id = await nowaSprawa(request, 'robert', 'Obraz w rozmowie')
    await request.post(`/api/sprawa/${id}/tura`, {
      headers: CIASTKO('robert'),
      data: { tresc: 'Narysuj prostą ikonę kota i zapisz jako ikona.png.' },
    })
    await page.goto(`/sprawa/${id}`)

    const strumien = page.locator('.max-w-strumien').first()
    const obraz = strumien.locator('img[alt="ikona.png"]')
    await expect(obraz).toBeVisible({ timeout: 150_000 })
    const b = await obraz.boundingBox()
    expect(b!.width).toBeGreaterThan(100)
  })
})

test.describe('Obszar 15 · Zdanie bez pokrycia w czynnościach', () => {
  const zapis = (nazwa: string, ok = true): DeskEvent[] => [
    { typ: 'narzedzie_start', id: 'z', nazwa: 'zapisz_dokument', etykieta: `Zapisuję ${nazwa}`, argumenty: { nazwa } },
    { typ: 'narzedzie_koniec', id: 'z', nazwa: 'zapisz_dokument', ok, podsumowanie: '100 znaków', ms: 5 },
  ]
  const plik = (nazwa: string): PlikMeta => ({
    sciezka: `Sprawy/x/${nazwa}`, nazwa, katalog: false, rozmiar: 10, zmieniony: '2026-01-01T00:00:00Z',
  })

  test('Plik ogłoszony w odpowiedzi, którego nikt nie zapisał, zostaje zgłoszony', () => {
    const b = obietniceBezPokrycia('Gotowe. Zapisano dokument malpy.md w teczce sprawy.', [], [])
    expect(b).toEqual(['malpy.md'])
  })

  test('Plik, który naprawdę powstał, nie jest zgłaszany', () => {
    const b = obietniceBezPokrycia('Gotowe. Zapisano dokument malpy.md.', zapis('malpy.md'), [])
    expect(b).toHaveLength(0)
  })

  test('Nieudany zapis nie jest pokryciem', () => {
    const b = obietniceBezPokrycia('Zapisano dokument malpy.md.', zapis('malpy.md', false), [])
    expect(b).toEqual(['malpy.md'])
  })

  test('Plik leżący w teczce nie jest zgłaszany, choćby powstał wcześniej', () => {
    const b = obietniceBezPokrycia('Zapisano wcześniej slonie.md.', [], [plik('slonie.md')])
    expect(b).toHaveLength(0)
  })

  test('Zdanie, które niczego sobie nie przypisuje, nie wywołuje ostrzeżenia', () => {
    const b = obietniceBezPokrycia('W pliku faktury-08.csv widzę 12 pozycji.', [], [])
    expect(b).toHaveLength(0)
  })

  test('Lista tego, co powstało, pomija czynności nieudane', () => {
    expect(wytworzone(zapis('a.md'))).toEqual(['a.md'])
    expect(wytworzone(zapis('a.md', false))).toHaveLength(0)
  })
})

test.describe('Obszar 16 · Załącznik nie udaje wyniku pracy', () => {
  const plik = (nazwa: string): PlikMeta => ({
    sciezka: `Sprawy/x/${nazwa}`, nazwa, katalog: false, rozmiar: 10, zmieniony: '2026-01-01T00:00:00Z',
  })

  test('Wgranie znaczy pochodzenie od razu, jeszcze przed wysłaniem polecenia', () => {
    const { wyniki, zalaczniki } = podzielTeczke(
      [plik('moje.csv'), plik('wynik.md')],
      [{ typ: 'zalacznik', nazwy: ['moje.csv'] }],
    )
    expect(zalaczniki.map((p) => p.nazwa)).toEqual(['moje.csv'])
    expect(wyniki.map((p) => p.nazwa)).toEqual(['wynik.md'])
  })

  test('Plik wgrany i jeszcze nieodnotowany też nie jest wynikiem', () => {
    const { wyniki } = podzielTeczke([plik('moje.csv')], [], ['moje.csv'])
    expect(wyniki).toHaveLength(0)
  })

  test('Wgrany załącznik nie pojawia się w panelu jako gotowy dokument', async ({ page, request }) => {
    await jako(page, 'anna')
    const id = await nowaSprawa(request, 'anna', 'Wgranie bez wysłania')
    await request.post('/api/pliki/wgraj', {
      headers: CIASTKO('anna'),
      multipart: {
        sprawaId: id,
        plik: { name: 'zestawienie-testowe.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') },
      },
    })
    await page.goto(`/sprawa/${id}`)

    await expect(panelu(page).getByText('Tu pojawi się gotowy dokument.')).toBeVisible()
    await expect(panelu(page).getByRole('button', { name: /Od Ciebie \(1\)/ })).toBeVisible()
  })
})

test.describe('Obszar 18 · Awaria mówi prawdę, ale nie cudzymi słowami', () => {
  test('Brak środków u dostawcy nie jest mylony z dziennym limitem pracownika', () => {
    const m = czytelnyBlad(new Error('402 Insufficient credits to complete this request'))
    expect(m).toContain('Skończyły się środki')
    expect(m).toContain('To nie jest Twój dzienny limit')
  })

  // Scenariusz spisany po zdarzeniu: bramka stała 11 scenariuszami na zdaniu „skończyły się
  // środki", a środki były — dostawca odbijał turę, bo rezerwował pod nią `max_tokens` równe
  // maksimum modelu i nie mieścił się w pułapie klucza. Oba zdania mówią o pieniądzach,
  // ale odblokowuje je co innego, więc muszą się różnić.
  test('Za ciasny pułap na kluczu to inna awaria niż brak środków', () => {
    const m = czytelnyBlad(new Error(
      'This request requires more credits, or fewer max_tokens. You requested up to 64000 tokens, ' +
      'but can only afford 54795. To increase, visit https://openrouter.ai/workspaces/default/keys/327df36',
    ))
    expect(m).toContain('Pułap na kluczu')
    expect(m).toContain('To nie jest Twój dzienny limit')
    expect(m).not.toContain('Skończyły się środki')
  })

  test('Komunikat dla pracownika nie niesie adresu panelu dostawcy', () => {
    const m = czytelnyBlad(new Error('Coś padło. Szczegóły: https://openrouter.ai/workspaces/default/keys/327df36'))
    expect(m).not.toMatch(/https?:\/\//)
    expect(m).not.toMatch(/openrouter/i)
  })

  test('Znane awarie mają własne zdania, nie surowy tekst dostawcy', () => {
    expect(czytelnyBlad(new Error('401 Unauthorized'))).toMatch(/klucza do modelu/)
    expect(czytelnyBlad(new Error('rate limit exceeded'))).toMatch(/limit zapytań/)
    expect(czytelnyBlad(new Error('fetch failed'))).toMatch(/cortex-proxy/)
  })
})
