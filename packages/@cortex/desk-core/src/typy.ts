/** Słownik zdarzeń jest NASZ. Żaden typ biblioteki agentowej nie przekracza tej granicy. */
export type DeskEvent =
  | { typ: 'lifecycle'; stan: 'start' | 'koniec' | 'przerwane' | 'blad'; powod?: string }
  | { typ: 'mysl'; tekst: string; zalaczniki?: string[] }
  | { typ: 'zalacznik'; nazwy: string[] }
  | { typ: 'assistant'; tekst: string }
  | { typ: 'narzedzie_start'; id?: string; nazwa: string; etykieta: string; argumenty: Record<string, unknown>; zrodlo?: string }
  | { typ: 'narzedzie_koniec'; id?: string; nazwa: string; ok: boolean; podsumowanie: string; ms: number }
  | { typ: 'zablokowane'; opis: string; zdolnoscId?: string; nazwa?: string; dzial?: string }
  | { typ: 'koszt'; usd: number }

export type Zdolnosc = { id: string; nazwa: string; dzial: string; opis: string }
export type Rola = 'szeregowy' | 'zarzad'

export type Uzytkownik = {
  id: string; imie: string; nazwisko: string; dzial: string; rola: Rola
  zlecenia: { tytul: string; podpowiedz: string; tresc: string }[]
}

/** Wynik materializacji polityki — to, co fizycznie trafia do instancji. */
export type Polityka = {
  uzytkownik: string
  rola: Rola
  przyznane: Zdolnosc[]
  zablokowane: Zdolnosc[]
  limitUsdNaDzien: number
  odcisk: string
}

export type StanSprawy = 'nowa' | 'pracuje' | 'gotowe' | 'przerwane' | 'blad'

export type Sprawa = {
  id: string; wlasciciel: string; tytul: string; stan: StanSprawy
  utworzona: string; zmieniona: string; kosztUsd: number; powod: string | null
}

export type Wpis = { seq: number; at: string; event: DeskEvent }

export type PlikMeta = {
  sciezka: string; nazwa: string; katalog: boolean; rozmiar: number; zmieniony: string
}
