import { test, expect, jako } from './osoby'

/**
 * Nadania i prośby żyją w bazie, więc bez sprzątania kolejny przebieg zaczyna
 * z Anną, która ma już przyznane zdolności — i połowa scenariuszy przestaje mieć sens.
 */
test.beforeEach(async ({ request }) => {
  await request.post('/api/test/reset-uprawnien', { headers: { Cookie: 'desk_persona=robert' } })
})

test.describe('Obszar 10 · Governance widać na ekranie', () => {
  test('Ekran nadzoru jest wyłącznie dla przełożonego', async ({ page }) => {
    await jako(page, 'anna')
    const r = await page.goto('/nadzor')
    expect(r?.status()).toBe(404)

    await jako(page, 'robert')
    await page.goto('/nadzor')
    await expect(page.getByRole('heading', { name: 'Nadzór' })).toBeVisible()
  })

  test('Pracownik nie może przyznać zdolności sam sobie', async ({ request }) => {
    const naglowki = { Cookie: 'desk_persona=anna' }
    await request.post('/api/prosba', { headers: naglowki, data: { zdolnosc: 'arkusz.zapisz' } })
    const moje = await (await request.get('/api/prosba', { headers: naglowki })).json()
    const p = moje.prosby.find((x: { zdolnosc: string }) => x.zdolnosc === 'arkusz.zapisz')

    const proba = await request.patch('/api/prosba', {
      headers: naglowki, data: { id: p.id, decyzja: 'przyznana' },
    })
    expect(proba.status()).toBe(403)
  })

  test('Prośba przeżywa odświeżenie strony', async ({ page }) => {
    await jako(page, 'anna')
    await page.goto('/co-potrafie')
    await page.getByRole('button', { name: 'Poproś o dostęp' }).first().click()
    await expect(page.getByText('Prośba wysłana — czeka na rozpatrzenie')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Prośba wysłana — czeka na rozpatrzenie')).toBeVisible()
  })

  test('Przyznanie przez przełożonego naprawdę zmienia zakres pracownika', async ({ page, request }) => {
    const annaH = { Cookie: 'desk_persona=anna' }

    await jako(page, 'anna')
    await page.goto('/co-potrafie')
    await expect(page.getByText('zgoda należy do działu: Finanse')).toBeVisible()
    await request.post('/api/prosba', { headers: annaH, data: { zdolnosc: 'arkusz.zapisz' } })

    await jako(page, 'robert')
    await page.goto('/nadzor')
    await expect(page.getByText('prosi o zdolność „Tworzenie arkuszy"')).toBeVisible()
    await page.getByRole('button', { name: 'Przyznaj' }).first().click()
    await expect(page.getByText('ma teraz zdolność')).toBeVisible()

    // zakres Anny zmienił się naprawdę — nie tylko stan prośby
    await jako(page, 'anna')
    await page.goto('/co-potrafie')
    await expect(page.getByText('zgoda należy do działu: Finanse')).toHaveCount(0)
    await expect(page.getByText('Tworzenie arkuszy')).toBeVisible()
  })

  test('Przełożony może cofnąć to, co przyznał', async ({ page, request }) => {
    const annaH = { Cookie: 'desk_persona=anna' }
    await request.post('/api/prosba', { headers: annaH, data: { zdolnosc: 'arkusz.zapisz' } })
    const wszystkie = await (await request.get('/api/prosba', { headers: { Cookie: 'desk_persona=robert' } })).json()
    const p = wszystkie.prosby.find((x: { zdolnosc: string; stan: string }) => x.zdolnosc === 'arkusz.zapisz' && x.stan === 'oczekuje')
    await request.patch('/api/prosba', {
      headers: { Cookie: 'desk_persona=robert' }, data: { id: p.id, decyzja: 'przyznana' },
    })

    await jako(page, 'robert')
    await page.goto('/nadzor')
    await page.getByRole('button', { name: 'Cofnij' }).first().click()
    await expect(page.getByText('cofnięta osobie')).toBeVisible()

    await jako(page, 'anna')
    await page.goto('/co-potrafie')
    await expect(page.getByText('zgoda należy do działu: Finanse')).toBeVisible()
  })

  test('Dziennik mówi po polsku, nie surowym JSON-em', async ({ page, request }) => {
    await request.post('/api/prosba', {
      headers: { Cookie: 'desk_persona=anna' }, data: { zdolnosc: 'obraz.generuj' },
    })
    await jako(page, 'robert')
    await page.goto('/nadzor')
    const dziennik = page.getByRole('heading', { name: 'Co się działo' })
    await expect(dziennik).toBeVisible()
    await expect(page.getByText('poprosiła o zdolność „Generowanie obrazów"').first()).toBeVisible()
    await expect(page.getByText(/\{"|\}/)).toHaveCount(0)
  })
})
