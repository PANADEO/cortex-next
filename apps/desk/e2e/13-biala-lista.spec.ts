import { test, expect } from './osoby'
import { dowodZeZdarzen } from '../src/core/dowod'
import { KATALOG_SERWEROW, NARZEDZIA_BIALEJ_LISTY } from '../src/core/mcp/katalog'
import type { DeskEvent } from '../src/core/typy'

const ANNA = { Cookie: 'desk_persona=anna' }
const ROBERT = { Cookie: 'desk_persona=robert' }
const NIP_MF = '5260250274'

/** Nadanie przez przełożonego — tą samą drogą, którą klika się w Nadzorze. */
async function nadaj(request: any, zdolnosc: string) {
  await request.post('/api/prosba', { headers: ANNA, data: { zdolnosc } })
  const moje = await (await request.get('/api/prosba', { headers: ANNA })).json()
  const p = moje.prosby.find((x: { zdolnosc: string }) => x.zdolnosc === zdolnosc)
  const r = await request.patch('/api/prosba', { headers: ROBERT, data: { id: p.id, decyzja: 'przyznana' } })
  expect(r.ok()).toBeTruthy()
}

async function tura(request: any, tytul: string, tresc: string) {
  const { id } = await (await request.post('/api/sprawa/nowa', { headers: ANNA, data: { tytul } })).json()
  const start = await request.post(`/api/sprawa/${id}/tura`, { headers: ANNA, data: { tresc } })
  // odmowa (np. wyczerpany dzienny limit) ma zgasić test od razu i po imieniu,
  // a nie udawać tury, która się nie kończy przez sto sześćdziesiąt sekund
  if (!start.ok()) throw new Error(`tura odrzucona (${start.status()}): ${(await start.text()).slice(0, 200)}`)
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const d = await (await request.get(`/api/sprawa/${id}/zdarzenia`, { headers: ANNA })).json()
    if (d.sprawa.stan !== 'pracuje' && d.sprawa.stan !== 'nowa') return { id, zdarzenia: d.zdarzenia as { event: DeskEvent }[] }
  }
  throw new Error('tura się nie skończyła')
}

const nazwy = (z: { event: DeskEvent }[]) =>
  z.filter((x) => x.event.typ === 'narzedzie_start').map((x) => (x.event as { nazwa: string }).nazwa)

test.describe('Obszar 24 · Zdolność sięgająca poza firmę przechodzi tą samą bramą', () => {
  test('Wykaz jest zatwierdzony narzędzie po narzędziu, nie w całości', () => {
    expect(NARZEDZIA_BIALEJ_LISTY.length).toBeGreaterThan(1)
    // każde narzędzie ma własny odcisk i własny opis pisany po polsku przez człowieka
    for (const n of NARZEDZIA_BIALEJ_LISTY) {
      expect(n.odcisk).toMatch(/^[0-9a-f]{64}$/)
      expect(n.opis.length).toBeGreaterThan(40)
      expect(n.krotko.length).toBeLessThan(40)
      expect(n.zdolnoscId).toBe('kontrahent.sprawdz')
    }
    // odciski są RÓŻNE — inaczej zgoda na jedno narzędzie otwierałaby drugie
    expect(new Set(NARZEDZIA_BIALEJ_LISTY.map((n) => n.odcisk)).size).toBe(NARZEDZIA_BIALEJ_LISTY.length)
  })

  test('Instancja bez skonfigurowanego adresu nie zna żadnego serwera', () => {
    // zatwierdzenia zostają danymi, ale bez adresu nic się nie rejestruje
    if (!process.env.MCP_BIALA_LISTA_URL) expect(KATALOG_SERWEROW).toHaveLength(0)
    else expect(KATALOG_SERWEROW[0].narzedzia).toEqual(NARZEDZIA_BIALEJ_LISTY)
  })

  test('Bez zgody przełożonego agent nie dostaje narzędzia z wykazu, tylko zgłasza brak', async ({ request }) => {
    test.setTimeout(200_000)
    await request.post('/api/test/reset-uprawnien')
    const { zdarzenia } = await tura(request, 'Kontrahent bez zgody',
      `Sprawdź w wykazie, czy firma o NIP ${NIP_MF} jest czynnym podatnikiem VAT.`)

    // filtr na odkryciu: narzędzia po prostu nie ma w rejestrze modelu
    expect(nazwy(zdarzenia).filter((n) => n.startsWith('mcp_'))).toHaveLength(0)
    expect(zdarzenia.some((x) => x.event.typ === 'zablokowane')).toBeTruthy()
  })

  test('Po nadaniu agent naprawdę odpytuje wykaz Ministerstwa Finansów', async ({ request }) => {
    test.setTimeout(200_000)
    await request.post('/api/test/reset-uprawnien')
    await nadaj(request, 'kontrahent.sprawdz')

    const { zdarzenia } = await tura(request, 'Kontrahent po zgodzie',
      `Sprawdź w wykazie, czy firma o NIP ${NIP_MF} jest czynnym podatnikiem VAT i jak się nazywa.`)

    expect(nazwy(zdarzenia)).toContain('mcp_biala_lista_sprawdz_nip')
    const koniec = zdarzenia.find((x) => x.event.typ === 'narzedzie_koniec')
    expect((koniec!.event as { ok: boolean }).ok).toBe(true)
    // odpowiedź pochodzi z wykazu, nie z pamięci modelu
    const odpowiedz = zdarzenia.filter((x) => x.event.typ === 'assistant')
      .map((x) => (x.event as { tekst: string }).tekst).join(' ')
    expect(odpowiedz).toMatch(/MINISTERSTWO FINANSÓW|Ministerstwo Finansów/i)
  })
})

test.describe('Obszar 25 · Odpowiedź obcego serwera nie udaje wykonanej pracy', () => {
  const obce: DeskEvent[] = [
    {
      typ: 'narzedzie_start', id: 'z', nazwa: 'mcp_biala_lista_sprawdz_rachunek',
      etykieta: 'sprawdzenie rachunku w wykazie', zrodlo: 'wykaz podatników VAT',
      argumenty: { nip: NIP_MF },
    },
    { typ: 'narzedzie_koniec', id: 'z', nazwa: 'mcp_biala_lista_sprawdz_rachunek', ok: true, podsumowanie: 'serwer odpowiedział', ms: 110 },
  ]

  test('Odpytanie trafia do osobnej listy, nie między rzeczy zrobione', () => {
    const d = dowodZeZdarzen(obce)
    expect(d.zewnetrzne).toHaveLength(1)
    expect(d.zrobione).toHaveLength(0)
    expect(d.weszlo).toHaveLength(0)
  })

  test('Wiersz nazywa źródło po ludzku, a nie kluczem narzędzia', () => {
    const [w] = dowodZeZdarzen(obce).zewnetrzne
    expect(w).toContain('wykaz podatników VAT')
    expect(w).toContain('sprawdzenie rachunku w wykazie')
    expect(w).not.toContain('mcp_')
  })

  test('Przebieg mówi o odpytaniu wykazu, nie o slugu serwera', async ({ page, request }) => {
    test.setTimeout(200_000)
    await request.post('/api/test/reset-uprawnien')
    await nadaj(request, 'kontrahent.sprawdz')
    const { id } = await tura(request, 'Wykaz na ekranie',
      `Sprawdź w wykazie status VAT firmy o NIP ${NIP_MF}.`)

    await page.context().addCookies([{ name: 'desk_persona', value: 'anna', url: 'http://localhost:3210' }])
    await page.goto(`/sprawa/${id}`)
    await expect(page.getByText('wykaz podatników VAT').first()).toBeVisible()
    await expect(page.getByText('Pytałem poza firmą:')).toBeVisible()
    // najważniejsze: odpytanie obcego serwera NIE jest opisane jako sprawdzone
    await expect(page.getByText('Sprawdzone:')).toHaveCount(0)
  })
})
