/**
 * KARTA NARZĘDZIA — jedno miejsce, które wie, czym jest dana czynność.
 *
 * Do tej pory wiedzę tę trzymały trzy niezależne tablice nazw: `switch` w `opisKroku`,
 * seria `licz('...')` w `podsumujGrupe` i siedem `if (k.nazwa === ...)` w `dowodZeZdarzen`.
 * Wszystkie trzy były ZAMKNIĘTE i żadna nie miała gałęzi domyślnej, więc narzędzie spoza
 * tej listy — czyli każde narzędzie z serwera MCP — dawało sprawę, w której zdarzenia
 * zapisują się poprawnie, przebieg pokazuje surową etykietę, a panel „Co weszło / Co zrobione"
 * jest PUSTY. Bez błędu, bez logu, wyglądając na to, że agent nic nie zrobił.
 *
 * To była najgroźniejsza rzecz w całym planie MCP: produkt, którego jedynym argumentem
 * jest dowód, przestawałby dowodzić po cichu. Dlatego `karta()` zawsze coś zwraca,
 * a nieznane narzędzie ma własną klasę i własny wiersz dowodu.
 */

/** Co czynność robi ze światem. Z tego wynika i zdanie w przebiegu, i wiersz dowodu. */
export type KlasaNarzedzia =
  | 'przeglada'   // wylicza, co jest — niczego nie zmienia i niczego nie wnosi
  | 'czyta'       // wnosi treść z biurka do sprawy
  | 'wytwarza'    // po tej czynności w teczce przybywa plik
  | 'sprawdza'    // potwierdza to, co już powstało
  | 'liczy'       // liczy w piaskownicy
  | 'odklada'     // przenosi do „Moich plików"
  | 'zewnetrzna'  // wychodzi poza to biurko — klasa domyślna dla obcego serwera

/** Człon podsumowania grupy. Człony o tym samym kluczu sumują się w jedno zdanie. */
export type GrupaKarty = {
  klucz: string
  czasownik: string
  /** rzeczownik do odmiany: [1, 2–4, 5+]. Brak = człon bez liczby. */
  liczone?: [string, string, string]
  sufiks?: string
  /** przy skracaniu odpadają najpierw człony o najniższej wadze — dokument nigdy */
  waga: number
}

export type KartaNarzedzia = {
  nazwa: string
  klasa: KlasaNarzedzia
  /** czasownik w toku i po zakończeniu: „Zapisuję" / „Zapisałem" */
  trwa: string
  ok: string
  /** który argument niesie nazwę rzeczy, a który pełną ścieżkę do szczegółu */
  argNazwa?: string
  argSciezka?: string
  /** gdy nie ma podsumowania z narzędzia, szczegół bierzemy z tego argumentu */
  argDetal?: string
  /** brak `grupa` znaczy: ta czynność świadomie nie wchodzi do zdania podsumowania */
  grupa?: GrupaKarty
  /**
   * Do której listy dowodu trafia udana czynność i jakim zdaniem.
   * Brak = czynność nie zostawia wiersza (tak jest z przeglądaniem teczki).
   */
  dowod?: {
    lista: 'weszlo' | 'zrobione' | 'zewnetrzne'
    fraza: (nazwa: string, detal: string, k?: { etykieta: string; zrodlo: string }) => string
  }
  /**
   * Czy wytworzony plik podlega regule „zapisany, a nieodczytany po zapisie = NIESPRAWDZONY".
   * Obraz jej NIE podlega: nikt go po zapisie nie czyta, więc plakietka byłaby pochwałą bez pokrycia.
   */
  sprawdzalny?: boolean
  /** skąd pochodzi — dla narzędzi MCP nazwa serwera, którą wpisał zatwierdzający */
  zrodlo: string
}

const K = (k: KartaNarzedzia) => k

export const KATALOG_NARZEDZI: Record<string, KartaNarzedzia> = Object.fromEntries(
  [
    K({
      nazwa: 'lista_plikow', klasa: 'przeglada', trwa: 'Przeglądam teczkę', ok: 'Przejrzałem teczkę',
      grupa: { klucz: 'teczka', czasownik: 'przejrzałem teczkę', waga: 1 }, zrodlo: 'wbudowane',
    }),
    K({
      nazwa: 'czytaj_plik', klasa: 'czyta', trwa: 'Czytam', ok: 'Przeczytałem',
      argNazwa: 'sciezka', argSciezka: 'sciezka',
      grupa: { klucz: 'czytanie', czasownik: 'przeczytałem', liczone: ['plik', 'pliki', 'plików'], waga: 3 },
      dowod: { lista: 'weszlo', fraza: (n, d) => `${n} — ${d}` },
      zrodlo: 'wbudowane',
    }),
    K({
      nazwa: 'zapisz_dokument', klasa: 'wytwarza', trwa: 'Zapisuję', ok: 'Zapisałem',
      argNazwa: 'nazwa', argSciezka: 'nazwa',
      grupa: { klucz: 'dokument', czasownik: 'zapisałem', liczone: ['dokument', 'dokumenty', 'dokumentów'], waga: 5 },
      dowod: { lista: 'zrobione', fraza: (n, d) => `zapisano ${n} — ${d}` }, sprawdzalny: true,
      zrodlo: 'wbudowane',
    }),
    K({
      nazwa: 'zapisz_arkusz', klasa: 'wytwarza', trwa: 'Zapisuję arkusz', ok: 'Zapisałem arkusz',
      argNazwa: 'nazwa', argSciezka: 'nazwa',
      // ten sam klucz co dokument: „zapisałem 2 dokumenty" zamiast dwóch osobnych członów
      grupa: { klucz: 'dokument', czasownik: 'zapisałem', liczone: ['dokument', 'dokumenty', 'dokumentów'], waga: 5 },
      dowod: { lista: 'zrobione', fraza: (n, d) => `zapisano arkusz ${n} — ${d}` }, sprawdzalny: true,
      zrodlo: 'wbudowane',
    }),
    K({
      nazwa: 'generuj_obraz', klasa: 'wytwarza', trwa: 'Rysuję obraz', ok: 'Narysowałem',
      argNazwa: 'nazwa', argSciezka: 'nazwa',
      grupa: { klucz: 'obraz', czasownik: 'narysowałem', liczone: ['obraz', 'obrazy', 'obrazów'], waga: 5 },
      dowod: { lista: 'zrobione', fraza: (n) => `wygenerowano ${n}` },
      zrodlo: 'wbudowane',
    }),
    K({
      // Świadomie BEZ `grupa`: sprawdzenie niesie stopka dowodu i plakietka przy pliku,
      // a w zdaniu podsumowania wypychałoby rzeczy, które człowiek chce zobaczyć.
      nazwa: 'sprawdz_dokument', klasa: 'sprawdza',
      trwa: 'Sprawdzam po zapisie', ok: 'Sprawdziłem po zapisie',
      argNazwa: 'nazwa', argSciezka: 'nazwa',
      dowod: { lista: 'zrobione', fraza: (n, d) => `odczytano ${n} po zapisie — ${d}` },
      zrodlo: 'wbudowane',
    }),
    K({
      nazwa: 'uruchom_obliczenia', klasa: 'liczy', trwa: 'Liczę', ok: 'Policzyłem',
      argDetal: 'opis',
      grupa: { klucz: 'liczenie', czasownik: 'policzyłem', waga: 4 },
      dowod: { lista: 'zrobione', fraza: (_n, d) => `policzono — ${d}` },
      zrodlo: 'wbudowane',
    }),
    K({
      nazwa: 'zapisz_do_moich_plikow', klasa: 'odklada',
      trwa: 'Odkładam do Moich plików', ok: 'Odłożyłem do Moich plików',
      argNazwa: 'nazwa', argSciezka: 'cel',
      grupa: {
        klucz: 'odlozone', czasownik: 'odłożyłem', liczone: ['plik', 'pliki', 'plików'],
        sufiks: 'do Moich plików', waga: 5,
      },
      dowod: { lista: 'zrobione', fraza: (_n, d) => `odłożono do Moich plików: ${d}` },
      zrodlo: 'wbudowane',
    }),
  ].map((k) => [k.nazwa, k]),
)

/** Rejestr rozszerzalny w czasie działania — tędy wejdą narzędzia z zatwierdzonych serwerów MCP. */
const dodatkowe = new Map<string, KartaNarzedzia>()

export function dopiszKarte(k: KartaNarzedzia) {
  dodatkowe.set(k.nazwa, k)
}

/** Nazwa serwera z klucza `mcp_<serwer>_<narzedzie>`; dla reszty — pusto. */
function zrodloZNazwy(nazwa: string): string | null {
  return /^mcp_([a-z0-9]+)_/.exec(nazwa)?.[1] ?? null
}

/**
 * Karta ZAWSZE istnieje. Dla nieznanego narzędzia budujemy ją tak, żeby przebieg i dowód
 * powiedziały prawdę: że coś się wydarzyło, że pochodziło z zewnątrz i od kogo.
 * Etykieta w zdarzeniu jest nasza — pisze ją nasz kod przy wywołaniu, nie obcy serwer.
 */
export function karta(nazwa: string, zrodloZeZdarzenia?: string): KartaNarzedzia {
  const znana = dodatkowe.get(nazwa) ?? KATALOG_NARZEDZI[nazwa]
  if (znana) return znana

  // Nazwa źródła przychodzi w zdarzeniu, bo rejestr `dopiszKarte` żyje w procesie
  // serwera, a przebieg i dowód rysuje przeglądarka. Prefiks klucza to ostatnia deska
  // ratunku — nie rozróżni serwera `biala-lista` od `biala`.
  const serwer = zrodloZeZdarzenia ?? zrodloZNazwy(nazwa)
  const zrodlo = serwer ?? 'poza katalogiem'
  return {
    nazwa,
    klasa: 'zewnetrzna',
    trwa: serwer ? `Odpytuję ${serwer}` : 'Wykonuję czynność spoza katalogu',
    ok: serwer ? `Odpytałem ${serwer}` : 'Wykonałem czynność spoza katalogu',
    grupa: {
      klucz: `zewnetrzne:${zrodlo}`,
      czasownik: serwer ? `odpytałem ${serwer}` : 'wykonałem',
      liczone: ['raz', 'razy', 'razy'],
      waga: 4,
    },
    dowod: {
      // Osobna lista, nie „Co zrobione" i nie „Co weszło": `ok: true` z obcego serwera
      // znaczy „odpowiedział", a nie „rzecz się wydarzyła". Nazwanie tego sprawdzonym
      // byłoby dokładnie tym, przed czym ten produkt ma bronić.
      lista: 'zewnetrzne',
      fraza: (_n, d, k) => `${zrodlo}: ${k?.etykieta || nazwa}${d ? ` — ${d}` : ''}`,
    },
    zrodlo,
  }
}

/** Czy po tej czynności w teczce naprawdę przybywa plik. */
export const wytwarzaPlik = (nazwa: string) =>
  karta(nazwa).klasa === 'wytwarza' || karta(nazwa).klasa === 'odklada'
