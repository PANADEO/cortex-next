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

function model(uzytkownik: string) {
  const provider = createOpenAICompatible({
    name: 'cortex-proxy',
    baseURL: process.env.CORTEX_PROXY_URL!,
    // rejestr cortex-proxy to księga, do której sięgnie audytor — musi widzieć osobę, nie aplikację
    headers: { 'X-User-ID': uzytkownik },
  })
  return provider(process.env.DESK_MODEL!)
}

const SYSTEM = `Jesteś asystentem przy biurku pracownika polskiej firmy. Pomagasz w pracy — odpowiadasz na pytania, tłumaczysz, liczysz, piszesz, doradzasz — a do tego masz narzędzia, którymi sięgasz po pliki tej osoby i tworzysz dokumenty.

JAK ROZMAWIASZ
- Po polsku, krótko i konkretnie. Odbiorcą jest osoba nietechniczna: żadnego żargonu, żadnych nazw narzędzi w odpowiedzi.
- Nie używasz form, które zdradzają płeć („zrobiłem"/„zrobiłam"). Piszesz bezosobowo: „Gotowe", „Zapisane w teczce sprawy", „Wychodzi 20 450,70 zł".
- Zwykłe pytanie zasługuje na zwykłą odpowiedź. Jeśli ktoś pyta o rzecz spoza jego plików, po prostu odpowiadasz z własnej wiedzy — tak samo jak zrobiłby to kolega z biurka obok. NIE odsyłasz z kwitkiem tylko dlatego, że pytanie nie dotyczy dokumentów.
- Gdy czegoś nie wiesz albo Twoja wiedza mogła się zdezaktualizować, mówisz to wprost i podajesz, czego jesteś pewny, a czego nie.

CZEGO NIE ROBISZ NIGDY
- Nie zmyślasz liczb, dat, kwot ani treści dokumentów. W robocie na plikach klienta pomyłka kosztuje — lepiej powiedzieć „tego nie ma w pliku" niż zgadnąć.
- Nie twierdzisz, że coś sprawdziłeś, przeczytałeś albo zapisałeś, jeśli nie wywołałeś narzędzia. Człowiek widzi listę Twoich czynności i zobaczy rozbieżność.

PRACA NA PLIKACH
- Zanim policzysz cokolwiek z pliku, przeczytaj go narzędziem. Nie zgaduj zawartości z nazwy.
- Gotową robotę zapisujesz narzędziem, nie wklejasz długiego dokumentu do rozmowy. Krótką odpowiedź (kilka zdań, jedna liczba, wyjaśnienie) mówisz normalnie w rozmowie — nie robisz z niej pliku.
- Po zapisaniu dokumentu odczytaj go narzędziem sprawdzającym i napisz, co w nim faktycznie jest.
- Pliki, które tworzysz, trafiają do teczki tej sprawy. Do trwałych „Moich plików" przenosisz coś WYŁĄCZNIE wtedy, gdy człowiek o to poprosi.
- ZAWSZE, gdy nie możesz zrobić tego, o co proszą — bo nie masz odpowiedniej czynności ALBO bo takiej możliwości tu w ogóle nie ma (poczta, cudze systemy, internet) — NAJPIERW zgłoś to narzędziem zglos_brak z krótkim opisem tego, czego było trzeba, a dopiero potem odpowiedz. Ta informacja idzie do osoby, która może to zmienić; bez zgłoszenia nikt się nie dowie, że czegoś brakuje.
- Jeśli czegoś nie da się zrobić dostępnymi narzędziami, powiedz to wprost, wyjaśnij dlaczego i zaproponuj drogę naokoło.`

export function narzedziaDlaPolityki(u: Uzytkownik, p: Polityka, sprawaId: string) {
  const katalogSprawy = biurko.katalogSprawy(u.id, sprawaId)
  const zdarz = (e: DeskEvent) => dopiszZdarzenie(sprawaId, e)
  const t: Record<string, any> = {}

  // FILTR NA ODKRYCIU: rejestrujemy wyłącznie przyznane.
  // Model nie widzi narzędzia, którego rola nie dostała — nie ma czego odmawiać.

  /**
   * Rejestrowane ZAWSZE, dla każdej roli. Model nie zna listy zablokowanych zdolności
   * i nie może jej poznać — opisuje własnymi słowami, czego mu zabrakło, a dopasowanie
   * do katalogu robimy tutaj. Dzięki temu kłódka na ekranie pochodzi z CZYNNOŚCI agenta,
   * a nie z naszego domysłu o treści polecenia.
   */
  t.zglos_brak = tool({
    description:
      'Zgłasza, że do wykonania zlecenia zabrakło Ci czynności, której nie masz. ' +
      'Wywołaj to ZANIM napiszesz odpowiedź, a potem powiedz człowiekowi, co zrobiłeś zamiast tego.',
    inputSchema: z.object({
      czego_potrzebowalem: z.string().describe('krótko, po polsku, np. „zapisać to jako arkusz Excela"'),
    }),
    execute: async ({ czego_potrzebowalem }) => {
      const trafiona = dopasujZdolnosc(czego_potrzebowalem, p.zablokowane)
      await zdarz({
        typ: 'zablokowane',
        opis: czego_potrzebowalem,
        ...(trafiona ? { zdolnoscId: trafiona.id, nazwa: trafiona.nazwa, dzial: trafiona.dzial } : {}),
      })
      await dziennik.zapisz(u.id, 'zdolnosc.brak', { sprawaId, opis: czego_potrzebowalem, zdolnosc: trafiona?.id })
      return trafiona
        ? `Odnotowane. Tej czynności nie masz włączonej — zgodę wydaje dział ${trafiona.dzial}. Człowiek zobaczył prośbę o dostęp; zrób teraz to, co da się zrobić bez niej.`
        : 'Odnotowane. Powiedz człowiekowi wprost, czego nie da się zrobić, i zaproponuj drogę naokoło.'
    },
  })

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
        // Bez tego readFile(utf8) na .jpg zwraca śmieci z ok:true i wpisuje je do dowodu
        // jako „odczytany plik" — czyli dowód poświadcza coś, czego nie było.
        const nieTekstowy = nieDoOdczytu(sciezka)
        if (nieTekstowy) {
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'czytaj_plik', ok: false, podsumowanie: 'to nie jest plik tekstowy', ms: Date.now() - start })
          return nieTekstowy
        }
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

  if (maZdolnosc(p, 'pliki.zapisz')) {
    t.zapisz_do_moich_plikow = tool({
      description:
        'Odkłada plik z teczki bieżącej sprawy do trwałych „Moich plików" użytkownika. ' +
        'Wywołuj WYŁĄCZNIE wtedy, gdy człowiek wyraźnie o to poprosił — to jego prywatna przestrzeń, ' +
        'a nie miejsce, w którym sam z siebie zostawiasz robocze wyniki.',
      inputSchema: z.object({
        nazwa: z.string().describe('nazwa pliku z teczki sprawy, np. "zestawienie-kosztow.md"'),
        folder: z.string().optional().describe('podfolder w „Moich plikach", domyślnie korzeń'),
      }),
      execute: async ({ nazwa, folder }) => {
        const start = Date.now(), kid = randomUUID()
        const cel = folder?.trim() ? `Moje pliki/${folder.trim()}/${nazwa}` : `Moje pliki/${nazwa}`
        await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: 'zapisz_do_moich_plikow', etykieta: `Odkładam ${nazwa} do Moich plików`, argumenty: { nazwa, cel } })
        try {
          const gdzie = await biurko.kopiuj(u.id, `${katalogSprawy}/${nazwa}`, cel)
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'zapisz_do_moich_plikow', ok: true, podsumowanie: gdzie, ms: Date.now() - start })
          return `Plik jest teraz w „Moich plikach" jako ${gdzie}.`
        } catch (e) {
          await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: 'zapisz_do_moich_plikow', ok: false, podsumowanie: 'nie udało się odłożyć', ms: Date.now() - start })
          return `Nie udało się odłożyć pliku ${nazwa} do Moich plików. ${String(e).slice(0, 120)}`
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
export async function uruchomTure(u: Uzytkownik, p: Polityka, sprawaId: string, tresc: string, zalaczniki: string[] = []) {
  await migracja()
  await pool.query(`update desk.sprawa set stan='pracuje', powod=null, zmieniona=now() where id=$1`, [sprawaId])
  await dopiszZdarzenie(sprawaId, { typ: 'lifecycle', stan: 'start' })
  await dziennik.zapisz(u.id, 'tura.start', { sprawaId, odcisk: p.odcisk, zdolnosci: p.przyznane.map((z) => z.id) })

  const narzedzia = narzedziaDlaPolityki(u, p, sprawaId)

  const historia = await pool.query<{ payload: DeskEvent }>(
    `select payload from desk.zdarzenie where sprawa_id=$1 order by seq`, [sprawaId],
  )
  // Obrazy z załączników idą do modelu jako obraz, nie jako nazwa pliku — inaczej agent
  // odpowiada „nie umiem czytać obrazków", choć model widzi. Limitujemy liczbę, bo każdy
  // obraz kosztuje przy każdej kolejnej turze tej samej sprawy.
  const MAX_OBRAZOW = 4

  async function czesciWiadomosci(tekst: string, pliki: string[]) {
    const obrazy = pliki.filter((n) => /\.(png|jpe?g|gif|webp)$/i.test(n))
    const inne = pliki.filter((n) => !obrazy.includes(n))
    const czesci: any[] = []
    for (const nazwa of obrazy) {
      try {
        const dane = await biurko.czytajBinarnie(u.id, `${biurko.katalogSprawy(u.id, sprawaId)}/${nazwa}`)
        czesci.push({ type: 'image', image: dane, mediaType: typObrazu(nazwa) })
      } catch {
        inne.push(nazwa)
      }
    }
    const opisInnych = inne.length ? `\n\n[Załączone pliki w teczce sprawy: ${inne.join(', ')}]` : ''
    czesci.push({ type: 'text', text: tekst + opisInnych })
    return czesci
  }

  const wiadomosci: any[] = []
  let budzetObrazow = MAX_OBRAZOW
  const historiaMysli = historia.rows.filter((r) => r.payload.typ === 'mysl')
  const odKtorejWolnoObrazy = Math.max(0, historiaMysli.length - 1)

  let licznikMysli = 0
  for (const r of historia.rows) {
    const e = r.payload
    if (e.typ === 'assistant') wiadomosci.push({ role: 'assistant', content: e.tekst })
    if (e.typ === 'mysl') {
      const stare = e.zalaczniki ?? []
      // obrazy ze starszych tur pomijamy — liczy się bieżące pytanie i to bezpośrednio przed nim
      const wolno = licznikMysli >= odKtorejWolnoObrazy && budzetObrazow > 0
      licznikMysli++
      if (wolno && stare.length) {
        const czesci = await czesciWiadomosci(e.tekst, stare)
        budzetObrazow -= czesci.filter((c) => c.type === 'image').length
        wiadomosci.push({ role: 'user', content: czesci })
      } else {
        const opis = stare.length ? `\n\n[Załączone pliki w teczce sprawy: ${stare.join(', ')}]` : ''
        wiadomosci.push({ role: 'user', content: e.tekst + opis })
      }
    }
  }
  // Uwaga: trasa dopisuje zdarzenie „mysl" PRZED wywołaniem tury, więc bieżące polecenie
  // jest już ostatnią pozycją historii powyżej. Doklejanie go tu po raz drugi wysyłało
  // model dwa razy to samo — i podwójnie naliczało koszt oraz obraz.

  void (async () => {
    try {
      const wynik = await generateText({
        model: model(u.id),
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

/** Zwraca wyjaśnienie po polsku, jeśli pliku po prostu nie da się przeczytać jako tekst. */
function nieDoOdczytu(sciezka: string): string | null {
  const ext = sciezka.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic'].includes(ext)) {
    return 'To jest obraz, nie plik tekstowy. Poproś użytkownika, żeby dołączył go do wiadomości — wtedy go zobaczysz.'
  }
  if (['xlsx', 'xls'].includes(ext)) {
    return 'Nie umiem otworzyć pliku Excela. Poproś użytkownika, żeby zapisał go jako CSV (w Excelu: Plik → Zapisz jako → CSV) i wgrał ponownie.'
  }
  if (ext === 'docx' || ext === 'doc') {
    return 'Nie umiem otworzyć pliku Worda. Poproś użytkownika o wersję w formacie tekstowym albo o wklejenie treści.'
  }
  if (ext === 'pdf') {
    return 'Nie umiem odczytać PDF-a. Poproś użytkownika o wersję tekstową albo o wklejenie potrzebnego fragmentu.'
  }
  if (['zip', 'rar', '7z', 'exe', 'dmg'].includes(ext)) {
    return 'To jest archiwum albo program, nie dokument. Nie umiem tego otworzyć.'
  }
  return null
}

const TROPY: Record<string, RegExp> = {
  'arkusz.zapisz': /arkusz|excel|xlsx|spreadsheet|csv|tabel/i,
  'kod.uruchom': /policz|oblicz|przelicz|wykres|skrypt|kod|statystyk/i,
  'obraz.generuj': /obraz|grafik|rysun|ilustrac|zdjęci|wygeneruj.*obraz/i,
  'pliki.zapisz': /moich plik|do moich|trwal/i,
  'dokument.zapisz': /zapisa.*dokument|utworzy.*plik/i,
  'pliki.czytaj': /przeczyta|odczyta|otworzy.*plik/i,
  'pliki.lista': /lista plik|zajrze.*teczk|zobaczy.*plik/i,
}

/** Model opisuje brak swoimi słowami — nazwę zdolności i dział dokładamy my. */
function dopasujZdolnosc(opis: string, zablokowane: Polityka['zablokowane']) {
  return zablokowane.find((z) => TROPY[z.id]?.test(opis))
}

function typObrazu(nazwa: string) {
  const ext = nazwa.split('.').pop()?.toLowerCase()
  return ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg'
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
