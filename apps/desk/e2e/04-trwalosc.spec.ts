import { test, expect, jako } from './osoby'

const DLUGIE = 'Przeczytaj Moje pliki/faktury-08.csv, a potem napisz obszerną analizę kosztów: dla każdej z kategorii osobny akapit z komentarzem, rekomendacje oszczędnościowe i podsumowanie. Na koniec zapisz to jako analiza.md i sprawdź plik po zapisie.'

async function nowaZTura(request: any, tresc: string) {
  const r = await request.post('/api/sprawa/nowa', {
    headers: { Cookie: 'desk_persona=anna' }, data: { tytul: 'Trwałość' },
  })
  const { id } = await r.json()
  await request.post(`/api/sprawa/${id}/tura`, {
    headers: { Cookie: 'desk_persona=anna' }, data: { tresc },
  })
  return id as string
}

test.describe('Obszar 4 · Praca nie ginie', () => {
  test('Odświeżenie w trakcie tury pokazuje znacznik pracy i cały przebieg', async ({ page, request }) => {
    test.setTimeout(180_000)
    await jako(page, 'anna')
    const id = await nowaZTura(request, DLUGIE)
    await page.goto(`/sprawa/${id}`)
    await expect(page.getByText(/pracuje ·/)).toBeVisible({ timeout: 30_000 })
    const kroki = page.getByRole('list', { name: 'Kroki pracy' }).getByRole('button')
    await expect(kroki.first()).toBeVisible({ timeout: 60_000 })
    const przed = await kroki.count()

    await page.reload()

    await expect(page.getByText(/pracuje ·|gotowe/).first()).toBeVisible()
    // po odświeżeniu przebieg mógł się zwinąć — rozwijamy, żeby policzyć kroki
    const naglowek = page.getByRole('region', { name: 'Przebieg pracy' }).getByRole('button').first()
    if ((await naglowek.getAttribute('aria-expanded')) === 'false') await naglowek.click()
    const po = await page.getByRole('list', { name: 'Kroki pracy' }).getByRole('button').count()
    expect(po).toBeGreaterThanOrEqual(przed)
    expect(po).toBeGreaterThan(0)
    // historia jest kompletna także w źródle prawdy, nie tylko na ekranie
    const h = await request.get(`/api/sprawa/${id}/zdarzenia?od=0`, { headers: { Cookie: 'desk_persona=anna' } })
    const d = await h.json()
    expect(d.zdarzenia.some((z: any) => z.event.typ === 'mysl')).toBe(true)
    expect(d.zdarzenia.filter((z: any) => z.event.typ === 'narzedzie_start').length).toBeGreaterThan(0)
  })

  test('Stop kończy turę jako przerwaną, nie jako błąd', async ({ page, request }) => {
    test.setTimeout(120_000)
    await jako(page, 'anna')
    const id = await nowaZTura(request, DLUGIE)
    await page.goto(`/sprawa/${id}`)
    await page.getByRole('button', { name: 'Stop' }).click({ timeout: 30_000 })
    await expect(page.getByText('Praca przerwana.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Nie udało się wykonać zlecenia')).toHaveCount(0)
  })
})
