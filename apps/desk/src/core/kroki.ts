import type { DeskEvent } from './typy'

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
 */
export function opisKroku(k: Krok): Opis {
  const a = k.argumenty as Record<string, string>
  const trwa = k.stan === 'trwa'
  const detal = k.podsumowanie
  const plik = a.nazwa ? samaNazwa(a.nazwa) : a.sciezka ? samaNazwa(a.sciezka) : undefined
  const sciezka = a.sciezka ?? a.nazwa

  switch (k.nazwa) {
    case 'lista_plikow':
      return { tytul: trwa ? 'Przeglądam teczkę' : 'Przejrzałem teczkę', detal }
    case 'czytaj_plik':
      return { tytul: trwa ? 'Czytam' : 'Przeczytałem', plik, sciezka, detal }
    case 'zapisz_dokument':
      return { tytul: trwa ? 'Zapisuję' : 'Zapisałem', plik, sciezka, detal }
    case 'sprawdz_dokument':
      return { tytul: trwa ? 'Sprawdzam po zapisie' : 'Sprawdziłem po zapisie', plik, sciezka, detal }
    case 'zapisz_arkusz':
      return { tytul: trwa ? 'Zapisuję arkusz' : 'Zapisałem arkusz', plik, sciezka, detal }
    case 'uruchom_obliczenia':
      return { tytul: trwa ? 'Liczę' : 'Policzyłem', detal: k.podsumowanie ?? String(a.opis ?? '') }
    case 'generuj_obraz':
      return { tytul: trwa ? 'Rysuję obraz' : 'Narysowałem', plik, sciezka, detal }
    case 'zapisz_do_moich_plikow':
      return { tytul: trwa ? 'Odkładam do Moich plików' : 'Odłożyłem do Moich plików', plik, sciezka: String(a.cel ?? ''), detal }
    default:
      return { tytul: k.etykieta, detal }
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
 */
export function podsumujGrupe(kroki: Krok[]): string {
  const ile = (n: number, j: string, k: string, w: string) => {
    const d = n % 10, s = n % 100
    if (n === 1) return `${n} ${j}`
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${k}`
    return `${n} ${w}`
  }
  const zrobione = kroki.filter((k) => k.stan === 'ok')
  const licz = (n: string) => zrobione.filter((k) => k.nazwa === n).length

  // waga: przy nadmiarze odpadają najpierw człony najmniej niosące, nigdy powstały dokument
  const czlony: { tekst: string; waga: number }[] = []
  if (licz('lista_plikow')) czlony.push({ tekst: 'przejrzałem teczkę', waga: 1 })
  const czytane = licz('czytaj_plik')
  if (czytane) czlony.push({ tekst: `przeczytałem ${ile(czytane, 'plik', 'pliki', 'plików')}`, waga: 3 })
  if (licz('uruchom_obliczenia')) czlony.push({ tekst: 'policzyłem', waga: 4 })
  const dok = licz('zapisz_dokument') + licz('zapisz_arkusz')
  if (dok) czlony.push({ tekst: `zapisałem ${ile(dok, 'dokument', 'dokumenty', 'dokumentów')}`, waga: 5 })
  const obrazy = licz('generuj_obraz')
  if (obrazy) czlony.push({ tekst: `narysowałem ${ile(obrazy, 'obraz', 'obrazy', 'obrazów')}`, waga: 5 })
  const odlozone = licz('zapisz_do_moich_plikow')
  if (odlozone) czlony.push({ tekst: `odłożyłem ${ile(odlozone, 'plik', 'pliki', 'plików')} do Moich plików`, waga: 5 })
  // „sprawdziłem po zapisie" nie jest członem zdania — niesie je stopka dowodu i plakietka przy pliku

  if (!czlony.length) {
    return zrobione.length
      ? `Zrobione: ${ile(zrobione.length, 'czynność', 'czynności', 'czynności')}`
      : 'Nic nie zostało zrobione'
  }

  // trzy człony to granica czytelności jednym rzutem oka
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
