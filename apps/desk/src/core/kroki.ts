import type { DeskEvent } from './typy'
import { karta, type GrupaKarty } from './narzedzia'

/** Jeden krok pracy agenta: wywołanie narzędzia razem z jego wynikiem. */
export type Krok = {
  /** indeks zdarzenia `narzedzie_start` w strumieniu — pozwala odtworzyć czas i kolejność */
  i: number
  nazwa: string
  etykieta: string
  argumenty: Record<string, unknown>
  stan: 'trwa' | 'ok' | 'blad'
  podsumowanie?: string
  ms?: number
}

/**
 * Paruje `narzedzie_start` z `narzedzie_koniec`.
 *
 * Model może w jednym kroku wywołać kilka narzędzi naraz, więc ich zdarzenia potrafią się
 * przepleść — parujemy po `id`. Zdarzenia sprzed wprowadzenia `id` parujemy pozycyjnie,
 * czyli tak, jak działało to wcześniej.
 */
export function paruj(zdarzenia: DeskEvent[]): Krok[] {
  const kroki: Krok[] = []
  const poId = new Map<string, Krok>()
  const bezId: Krok[] = []

  for (let i = 0; i < zdarzenia.length; i++) {
    const e = zdarzenia[i]

    if (e.typ === 'narzedzie_start') {
      const k: Krok = { i, nazwa: e.nazwa, etykieta: e.etykieta, argumenty: e.argumenty, stan: 'trwa' }
      kroki.push(k)
      if (e.id) poId.set(e.id, k)
      else bezId.push(k)
      continue
    }

    if (e.typ === 'narzedzie_koniec') {
      const k = e.id ? poId.get(e.id) : bezId.shift()
      if (!k) continue
      k.stan = e.ok ? 'ok' : 'blad'
      k.podsumowanie = e.podsumowanie
      k.ms = e.ms
      if (e.id) poId.delete(e.id)
    }
  }
  return kroki
}

/** Nazwa pliku bez ścieżki — w tytule kroku pokazujemy sam plik, ścieżka schodzi do szczegółu. */
function samaNazwa(s: string) {
  return s.split('/').filter(Boolean).pop() ?? s
}

export type Opis = { tytul: string; plik?: string; sciezka?: string; detal?: string }

/**
 * Zamienia krok na zdanie po polsku. W toku — niedokonany, po zakończeniu — dokonany:
 * „Zapisuję zestawienie" w trakcie, „Zapisałem zestawienie" po. Bez tego zakończona
 * sprawa opowiada w czasie teraźniejszym o czymś, co już się stało.
 *
 * Czasowniki i argumenty biorą się z karty narzędzia, nie z `switch` po nazwach —
 * dzięki temu narzędzie z serwera MCP dostaje zdanie, a nie surowy klucz.
 */
export function opisKroku(k: Krok): Opis {
  const a = k.argumenty as Record<string, string>
  const c = karta(k.nazwa)
  const plik = c.argNazwa && a[c.argNazwa] ? samaNazwa(a[c.argNazwa]) : undefined
  const sciezka = c.argSciezka ? a[c.argSciezka] : undefined
  const detal = k.podsumowanie ?? (c.argDetal ? a[c.argDetal] : undefined)
  return {
    tytul: k.stan === 'trwa' ? c.trwa : c.ok,
    plik,
    sciezka,
    // etykieta jest NASZA — pisze ją nasz kod przy wywołaniu, nigdy obcy serwer
    detal: c.klasa === 'zewnetrzna' ? (detal ?? k.etykieta) : detal,
  }
}

/** Ile trwał krok, po ludzku: poniżej sekundy nie mówimy nic. */
export function czasKroku(ms?: number): string | null {
  if (ms == null || ms < 1000) return null
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`
}

/**
 * Jedno zdanie o całej grupie — to, co widać po zwinięciu przebiegu.
 * Liczymy czynności, nie kroki modelu: „przeczytałem 1 plik i zapisałem 1 dokument".
 *
 * Człony biorą się z kart. Dwa narzędzia o tym samym kluczu grupy sumują się w jeden
 * człon (dokument i arkusz to dla człowieka ta sama rzecz), a karta bez `grupa`
 * świadomie nie wchodzi do zdania.
 */
export function podsumujGrupe(kroki: Krok[]): string {
  const ile = (n: number, j: string, k: string, w: string) => {
    const d = n % 10, s = n % 100
    if (n === 1) return `${n} ${j}`
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${k}`
    return `${n} ${w}`
  }
  const zrobione = kroki.filter((k) => k.stan === 'ok')

  const wg = new Map<string, { g: GrupaKarty; n: number }>()
  for (const k of zrobione) {
    const g = karta(k.nazwa).grupa
    if (!g) continue
    const bylo = wg.get(g.klucz)
    if (bylo) bylo.n += 1
    else wg.set(g.klucz, { g, n: 1 })
  }

  // waga rośnie z wagą informacji; kolejność w zdaniu idzie od najlżejszego,
  // czyli tak, jak człowiek pracuje: najpierw rozejrzenie, na końcu wynik
  const czlony = [...wg.values()]
    .map(({ g, n }) => ({
      tekst: [g.czasownik, g.liczone ? ile(n, ...g.liczone) : null, g.sufiks].filter(Boolean).join(' '),
      waga: g.waga,
    }))
    .sort((a, b) => a.waga - b.waga)

  if (!czlony.length) {
    return zrobione.length
      ? `Zrobione: ${ile(zrobione.length, 'czynność', 'czynności', 'czynności')}`
      : 'Nic nie zostało zrobione'
  }

  // trzy człony to granica czytelności jednym rzutem oka; przy nadmiarze odpadają
  // najpierw człony najmniej niosące, nigdy powstały dokument
  const wybrane = [...czlony]
  while (wybrane.length > 3) {
    let najsl = 0
    for (let i = 1; i < wybrane.length; i++) if (wybrane[i].waga < wybrane[najsl].waga) najsl = i
    wybrane.splice(najsl, 1)
  }
  const pominieto = czlony.length - wybrane.length
  const t = wybrane.map((c) => c.tekst)
  // jeden pominięty człon i tak był najmniej ważny — dopisek „i 1 inną czynność" to sam szum
  if (pominieto > 1) t.push(ile(pominieto, 'inną czynność', 'inne czynności', 'innych czynności'))

  const zdanie = t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} i ${t[t.length - 1]}`
  return zdanie.charAt(0).toUpperCase() + zdanie.slice(1)
}
