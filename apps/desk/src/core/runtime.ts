import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { pool, migracja } from './db'
import * as biurko from './biurko'
import * as sandbox from './sandbox'
import * as dziennik from './dziennik'
import { maZdolnosc } from './brama-zdolnosci'
import type { DeskEvent, Polityka, Uzytkownik } from './typy'

/**
 * F4 · RUNTIME AGENTA — jedyne miejsce w kodzie, które zna bibliotekę agentową.
 * Na zewnątrz wychodzi wyłącznie nasz `DeskEvent`.
 */

export async function dopiszZdarzenie(sprawaId: string, e: DeskEvent) {
  await pool.query(`insert into desk.zdarzenie (sprawa_id, payload) values ($1,$2)`, [
    sprawaId,
    JSON.stringify(e),
  ])
}

function model() {
  const provider = createOpenAICompatible({
    name: 'cortex-proxy',
    baseURL: process.env.CORTEX_PROXY_URL!,
    headers: { 'X-User-ID': 'desk' },
  })
  return provider(process.env.DESK_MODEL!)
}

const SYSTEM = `Jesteś agentem przy biurku pracownika polskiej firmy. Mówisz po polsku, krótko i konkretnie.

ZASADY:
- Pracujesz na plikach z biurka użytkownika. Zanim cokolwiek napiszesz, sprawdź, co jest w teczce (lista_plikow) i przeczytaj to, co potrzebne (czytaj_plik).
- Gotową robotę ZAWSZE zapisujesz narzędziem zapisz_dokument. Nie wklejaj długiego dokumentu do rozmowy.
- Po zapisaniu dokumentu sprawdź go narzędziem sprawdz_dokument i napisz, co faktycznie w nim jest.
- Nigdy nie twierdź, że coś sprawdziłeś, jeśli nie wywołałeś narzędzia.
- Jeśli czegoś nie da się zrobić dostępnymi narzędziami, powiedz to wprost i zaproponuj, co zrobić.
- Odbiorcą jest osoba nietechniczna. Żadnego żargonu, żadnych nazw narzędzi w odpowiedzi.`

export function narzedziaDlaPolityki(u: Uzytkownik, p: Polityka, sprawaId: string) {
  const katalogSprawy = biurko.katalogSprawy(u.id, sprawaId)
  const zdarz = (e: DeskEvent) => dopiszZdarzenie(sprawaId, e)
  const t: Record<string, any> = {}

  // FILTR NA ODKRYCIU: rejestrujemy wyłącznie przyznane.
  // Model nie widzi narzędzia, którego rola nie dostała — nie ma czego odmawiać.

  if (maZdolnosc(p, 'pliki.lista')) {
    t.lista_plikow = tool({
      description: 'Pokazuje pliki na biurku użytkownika (Moje pliki oraz teczka bieżącej sprawy).',
      inputSchema: z.object({ katalog: z.string().optional().describe('domyślnie "Moje pliki"') }),
      execute: async ({ katalog }) => {
        const k = katalog?.trim() || 'Moje pliki'
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'lista_plikow', etykieta: `Przeglądam „${k}"`, argumenty: { katalog: k } })
        const l = await biurko.lista(u.id, k)
        const lSprawy = await biurko.lista(u.id, katalogSprawy).catch(() => [])
        const opis = [
          ...l.map((x) => `${x.katalog ? '[katalog] ' : ''}${x.sciezka} (${x.rozmiar} B)`),
          ...lSprawy.map((x) => `${x.sciezka} (${x.rozmiar} B)`),
        ].join('\n') || '(pusto)'
        await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'lista_plikow', ok: true, podsumowanie: `${l.length + lSprawy.length} pozycji`, ms: Date.now() - start })
        return opis
      },
    })
  }

  if (maZdolnosc(p, 'pliki.czytaj')) {
    t.czytaj_plik = tool({
      description: 'Czyta zawartość pliku tekstowego z biurka użytkownika.',
      inputSchema: z.object({ sciezka: z.string().describe('np. "Moje pliki/faktury-08.csv"') }),
      execute: async ({ sciezka }) => {
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'czytaj_plik', etykieta: `Czytam ${sciezka}`, argumenty: { sciezka } })
        try {
          const tresc = await biurko.czytaj(u.id, sciezka)
          const linie = tresc.split('\n').length
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'czytaj_plik', ok: true, podsumowanie: `${linie} wierszy, ${tresc.length} znaków`, ms: Date.now() - start })
          return tresc.slice(0, 60000)
        } catch (e) {
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'czytaj_plik', ok: false, podsumowanie: 'nie udało się otworzyć', ms: Date.now() - start })
          return `Nie udało się otworzyć pliku ${sciezka}.`
        }
      },
    })
  }

  if (maZdolnosc(p, 'dokument.zapisz')) {
    t.zapisz_dokument = tool({
      description: 'Zapisuje gotowy dokument do teczki bieżącej sprawy. Format markdown albo zwykły tekst.',
      inputSchema: z.object({ nazwa: z.string().describe('np. "zestawienie-kosztow.md"'), tresc: z.string() }),
      execute: async ({ nazwa, tresc }) => {
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'zapisz_dokument', etykieta: `Zapisuję ${nazwa}`, argumenty: { nazwa } })
        await biurko.zapisz(u.id, `${katalogSprawy}/${nazwa}`, tresc)
        await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'zapisz_dokument', ok: true, podsumowanie: `${tresc.length} znaków`, ms: Date.now() - start })
        return `Zapisano ${nazwa} w teczce sprawy.`
      },
    })
  }

  if (maZdolnosc(p, 'dokument.sprawdz')) {
    t.sprawdz_dokument = tool({
      description: 'Odczytuje zapisany dokument z teczki sprawy, żeby potwierdzić, co w nim faktycznie jest.',
      inputSchema: z.object({ nazwa: z.string() }),
      execute: async ({ nazwa }) => {
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'sprawdz_dokument', etykieta: `Sprawdzam ${nazwa} po zapisie`, argumenty: { nazwa } })
        try {
          const tresc = await biurko.czytaj(u.id, `${katalogSprawy}/${nazwa}`)
          const puste = (tresc.match(/\[(WPISZ|UZUPEŁNIJ|TODO)[^\]]*\]/gi) ?? []).length
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'sprawdz_dokument', ok: true, podsumowanie: `${tresc.split('\n').length} wierszy, pustych pól: ${puste}`, ms: Date.now() - start })
          return `Plik ma ${tresc.length} znaków. Nieuzupełnionych pól: ${puste}.\n\n${tresc.slice(0, 4000)}`
        } catch {
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'sprawdz_dokument', ok: false, podsumowanie: 'pliku nie ma', ms: Date.now() - start })
          return `Pliku ${nazwa} nie ma w teczce sprawy.`
        }
      },
    })
  }

  if (maZdolnosc(p, 'arkusz.zapisz')) {
    t.zapisz_arkusz = tool({
      description: 'Zapisuje zestawienie jako arkusz CSV do teczki sprawy.',
      inputSchema: z.object({ nazwa: z.string(), csv: z.string() }),
      execute: async ({ nazwa, csv }) => {
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'zapisz_arkusz', etykieta: `Zapisuję arkusz ${nazwa}`, argumenty: { nazwa } })
        await biurko.zapisz(u.id, `${katalogSprawy}/${nazwa}`, csv)
        await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'zapisz_arkusz', ok: true, podsumowanie: `${csv.split('\n').length} wierszy`, ms: Date.now() - start })
        return `Zapisano arkusz ${nazwa}.`
      },
    })
  }

  if (maZdolnosc(p, 'kod.uruchom')) {
    t.uruchom_obliczenia = tool({
      description: 'Uruchamia obliczenia na danych. Podaj kod w JavaScript (Node) oraz listę plików z biurka w polu `pliki` — zostaną zamontowane w katalogu roboczym pod swoimi nazwami (np. "faktury-08.csv"). Wypisz wynik przez console.log.',
      inputSchema: z.object({ opis: z.string().describe('po ludzku, co liczysz'), kod: z.string(), pliki: z.array(z.string()).optional() }),
      execute: async ({ opis, kod, pliki }) => {
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'uruchom_obliczenia', etykieta: opis, argumenty: { opis } })
        const box = await sandbox.utworz({
          uzytkownik: u.id,
          sprawaId,
          montaze: (pliki ?? []).map((f) => ({ zBiurka: f, jako: f.split('/').pop()!, zapis: false })),
          egress: [], // brak wyjścia do sieci — NIEEGZEKWOWANE w POC
        })
        const r = await box.exec(kod)
        await box.dispose()
        await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'uruchom_obliczenia', ok: r.ok, podsumowanie: r.ok ? 'policzone' : 'błąd wykonania', ms: Date.now() - start })
        return r.wyjscie || '(brak wyjścia)'
      },
    })
  }

  if (maZdolnosc(p, 'obraz.generuj')) {
    t.generuj_obraz = tool({
      description: 'Generuje obraz na podstawie opisu i zapisuje go w teczce sprawy.',
      inputSchema: z.object({ nazwa: z.string().describe('np. "grafika.png"'), opis: z.string() }),
      execute: async ({ nazwa, opis }) => {
        const start = Date.now(), kid = randomUUID()
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'generuj_obraz', etykieta: `Generuję obraz: ${opis.slice(0, 60)}`, argumenty: { nazwa, opis } })
        try {
          const res = await fetch(`${process.env.CORTEX_PROXY_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': u.id },
            body: JSON.stringify({
              model: process.env.DESK_IMAGE_MODEL,
              modalities: ['image', 'text'],
              messages: [{ role: 'user', content: opis }],
            }),
          })
          const j: any = await res.json()
          const url: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url
          if (j?.error?.message) throw new Error(String(j.error.message))
          if (!url?.startsWith('data:')) throw new Error('dostawca nie zwrócił obrazu')
          const b64 = url.split(',')[1]
          await biurko.zapisz(u.id, `${katalogSprawy}/${nazwa}`, Buffer.from(b64, 'base64'))
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'generuj_obraz', ok: true, podsumowanie: `zapisano ${nazwa}`, ms: Date.now() - start })
          return `Obraz zapisany jako ${nazwa}.`
        } catch (e) {
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'generuj_obraz', ok: false, podsumowanie: String(e).slice(0, 120), ms: Date.now() - start })
          const m = String(e)
          const czytelnie = /modalit|not a valid model|404/i.test(m)
            ? 'Na tej instancji nie ma podłączonego modelu graficznego — administrator musi go udostępnić w cortex-proxy.'
            : m.slice(0, 200)
          return `Nie udało się wygenerować obrazu. ${czytelnie}`
        }
      },
    })
  }

  return t
}

/** Uruchamia turę w tle. Zwraca natychmiast — praca trwa bez podpiętego klienta. */
export async function uruchomTure(u: Uzytkownik, p: Polityka, sprawaId: string, tresc: string) {
  await migracja()
  await pool.query(`update desk.sprawa set stan='pracuje', powod=null, zmieniona=now() where id=$1`, [sprawaId])
  await dopiszZdarzenie(sprawaId, { typ: 'lifecycle', stan: 'start' })
  await dziennik.zapisz(u.id, 'tura.start', { sprawaId, odcisk: p.odcisk, zdolnosci: p.przyznane.map((z) => z.id) })

  const narzedzia = narzedziaDlaPolityki(u, p, sprawaId)

  const historia = await pool.query<{ payload: DeskEvent }>(
    `select payload from desk.zdarzenie where sprawa_id=$1 order by seq`, [sprawaId],
  )
  const wiadomosci: any[] = []
  for (const r of historia.rows) {
    const e = r.payload
    if (e.typ === 'assistant') wiadomosci.push({ role: 'assistant', content: e.tekst })
    if (e.typ === 'mysl') wiadomosci.push({ role: 'user', content: e.tekst })
  }
  wiadomosci.push({ role: 'user', content: tresc })

  void (async () => {
    try {
      const wynik = await generateText({
        model: model(),
        system: `${SYSTEM}\n\nUżytkownik: ${u.imie} ${u.nazwisko}, dział ${u.dzial}. Teczka bieżącej sprawy: ${biurko.katalogSprawy(u.id, sprawaId)}.`,
        messages: wiadomosci,
        tools: narzedzia,
        stopWhen: stepCountIs(12),
      })

      const koszt = szacujKoszt(wynik)
      if (wynik.text?.trim()) await dopiszZdarzenie(sprawaId, { typ: 'assistant', tekst: wynik.text.trim() })
      if (koszt > 0) await dopiszZdarzenie(sprawaId, { typ: 'koszt', usd: koszt })
      await dopiszZdarzenie(sprawaId, { typ: 'lifecycle', stan: 'koniec' })
      await pool.query(
        `update desk.sprawa set stan='gotowe', powod=null, koszt_usd=koszt_usd+$2, zmieniona=now() where id=$1`,
        [sprawaId, koszt],
      )
      await dziennik.zapisz(u.id, 'tura.koniec', { sprawaId, kosztUsd: koszt })
    } catch (e: any) {
      const powod = czytelnyBlad(e)
      await dopiszZdarzenie(sprawaId, { typ: 'lifecycle', stan: 'blad', powod })
      await pool.query(`update desk.sprawa set stan='blad', powod=$2, zmieniona=now() where id=$1`, [sprawaId, powod])
      await dziennik.zapisz(u.id, 'tura.blad', { sprawaId, powod })
    }
  })()
}

function szacujKoszt(wynik: any): number {
  const meta = wynik?.providerMetadata ?? wynik?.experimental_providerMetadata
  const zProvidera = meta?.['cortex-proxy']?.cost ?? meta?.openaiCompatible?.cost
  if (typeof zProvidera === 'number') return zProvidera
  const u = wynik?.usage ?? {}
  const we = u.inputTokens ?? u.promptTokens ?? 0
  const wy = u.outputTokens ?? u.completionTokens ?? 0
  return (we / 1e6) * 3 + (wy / 1e6) * 15 // stawki Sonnet 4.5, szacunek POC
}

/** Awaria mówi prawdę: po polsku, z powodem — i NIGDY nie produkuje pliku. */
function czytelnyBlad(e: any): string {
  const s = String(e?.message ?? e)
  if (/401|unauthor|api key/i.test(s)) return 'Brak ważnego klucza do modelu — zgłoś to administratorowi.'
  if (/timeout|ETIMEDOUT|aborted/i.test(s)) return 'Model nie odpowiedział na czas. Spróbuj ponownie za chwilę.'
  if (/ECONNREFUSED|fetch failed/i.test(s)) return 'Nie udało się połączyć z usługą modelu. Sprawdź, czy cortex-proxy działa.'
  if (/rate limit|429/i.test(s)) return 'Przekroczony limit zapytań u dostawcy modelu. Spróbuj za minutę.'
  return `Wykonanie nie powiodło się: ${s.slice(0, 200)}`
}
