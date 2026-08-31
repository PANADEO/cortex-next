/**
 * KATALOG ZATWIERDZONYCH SERWERÓW — czyste dane, bez `server-only`, bo czyta je
 * także ekran przełożonego i testy. Maszyneria połączenia siedzi w `klient.ts`.
 *
 * Docelowo (krok 7) katalog przenosi się na ekran Nadzoru i do bazy, a stąd zostaje
 * wyłącznie typ. Dziś jest PUSTY i to jest stan, który sprawdza scenariusz:
 * dopóki nikt niczego nie zatwierdził, do modelu nie trafia ani jedno narzędzie
 * spoza tego repozytorium.
 */

export type ZatwierdzoneNarzedzie = {
  serwer: string
  nazwaZdalna: string
  /** opis PO POLSKU, napisany przez zatwierdzającego. NIGDY tekst przysłany przez serwer. */
  opis: string
  /** zdolność z katalogu, przez którą to narzędzie przechodzi bramę */
  zdolnoscId: string
  /** odcisk z chwili zatwierdzenia — inny schemat znaczy brak zgody */
  odcisk: string
}

export type SerwerMcp = {
  nazwa: string
  /** wyłącznie https i wyłącznie Streamable HTTP; stdio jest zabronione */
  url: string
  narzedzia: ZatwierdzoneNarzedzie[]
}

export const KATALOG_SERWEROW: SerwerMcp[] = []
