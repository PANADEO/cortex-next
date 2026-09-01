/**
 * KARTA NARZĘDZIA — jedno miejsce, które wie, czym jest dana czynność.
 *
 * Do tej pory wiedzę tę trzymały trzy niezależne tablice nazw: `switch` w `describeStep`,
 * seria `licz('...')` w `summariseGroup` i siedem `if (k.nazwa === ...)` w `evidenceFromEvents`.
 * Wszystkie trzy były ZAMKNIĘTE i żadna nie miała gałęzi domyślnej, więc narzędzie spoza
 * tej listy — czyli każde narzędzie z serwera MCP — dawało sprawę, w której zdarzenia
 * zapisują się poprawnie, przebieg pokazuje surową etykietę, a panel „Co weszło / Co zrobione"
 * jest PUSTY. Bez błędu, bez logu, wyglądając na to, że agent nic nie zrobił.
 *
 * To była najgroźniejsza rzecz w całym planie MCP: produkt, którego jedynym argumentem
 * jest dowód, przestawałby dowodzić po cichu. Dlatego `cardFor()` zawsze coś zwraca,
 * a nieznane narzędzie ma własną klasę i własny wiersz dowodu.
 */

/** Co czynność robi ze światem. Z tego wynika i zdanie w przebiegu, i wiersz dowodu. */
export type ToolClass =
  | "browses" // wylicza, co jest — niczego nie zmienia i niczego nie wnosi
  | "reads" // wnosi treść z biurka do sprawy
  | "produces" // po tej czynności w teczce przybywa plik
  | "verifies" // potwierdza to, co już powstało
  | "computes" // liczy w piaskownicy
  | "stores" // przenosi do „Moich plików"
  | "external" // wychodzi poza to biurko — klasa domyślna dla obcego serwera

/** Człon podsumowania grupy. Człony o tym samym kluczu sumują się w jedno zdanie. */
export type ToolGroup = {
  key: string
  verb: string
  /** rzeczownik do odmiany: [1, 2–4, 5+]. Brak = człon bez liczby. */
  countable?: [string, string, string]
  suffix?: string
  /** przy skracaniu odpadają najpierw człony o najniższej wadze — dokument nigdy */
  weight: number
}

export type ToolCard = {
  name: string
  kind: ToolClass
  /** czasownik w toku i po zakończeniu: „Zapisuję" / „Zapisałem" */
  running: string
  ok: string
  /** który argument niesie nazwę rzeczy, a który pełną ścieżkę do szczegółu */
  argName?: string
  argPath?: string
  /** gdy nie ma podsumowania z narzędzia, szczegół bierzemy z tego argumentu */
  argDetail?: string
  /** brak `grupa` znaczy: ta czynność świadomie nie wchodzi do zdania podsumowania */
  group?: ToolGroup
  /**
   * Do której listy dowodu trafia udana czynność i jakim zdaniem.
   * Brak = czynność nie zostawia wiersza (tak jest z przeglądaniem teczki).
   */
  evidence?: {
    list: "intake" | "produced" | "external"
    phrase: (name: string, detail: string, k?: { label: string; source: string }) => string
  }
  /**
   * Czy wytworzony plik podlega regule „zapisany, a nieodczytany po zapisie = NIESPRAWDZONY".
   * Obraz jej NIE podlega: nikt go po zapisie nie czyta, więc plakietka byłaby pochwałą bez pokrycia.
   */
  verifiable?: boolean
  /** skąd pochodzi — dla narzędzi MCP nazwa serwera, którą wpisał zatwierdzający */
  source: string
}

const K = (k: ToolCard) => k

export const TOOL_CARDS: Record<string, ToolCard> = Object.fromEntries(
  [
    K({
      name: "list_files",
      kind: "browses",
      running: "Przeglądam teczkę",
      ok: "Przejrzałem teczkę",
      group: { key: "teczka", verb: "przejrzałem teczkę", weight: 1 },
      source: "builtin",
    }),
    K({
      name: "read_file",
      kind: "reads",
      running: "Czytam",
      ok: "Przeczytałem",
      argName: "path",
      argPath: "path",
      group: {
        key: "czytanie",
        verb: "przeczytałem",
        countable: ["plik", "pliki", "plików"],
        weight: 3,
      },
      evidence: { list: "intake", phrase: (n, d) => `${n} — ${d}` },
      source: "builtin",
    }),
    K({
      name: "write_document",
      kind: "produces",
      running: "Zapisuję",
      ok: "Zapisałem",
      argName: "name",
      argPath: "name",
      group: {
        key: "dokument",
        verb: "zapisałem",
        countable: ["dokument", "dokumenty", "dokumentów"],
        weight: 5,
      },
      evidence: { list: "produced", phrase: (n, d) => `zapisano ${n} — ${d}` },
      verifiable: true,
      source: "builtin",
    }),
    K({
      name: "write_sheet",
      kind: "produces",
      running: "Zapisuję arkusz",
      ok: "Zapisałem arkusz",
      argName: "name",
      argPath: "name",
      // ten sam klucz co dokument: „zapisałem 2 dokumenty" zamiast dwóch osobnych członów
      group: {
        key: "dokument",
        verb: "zapisałem",
        countable: ["dokument", "dokumenty", "dokumentów"],
        weight: 5,
      },
      evidence: { list: "produced", phrase: (n, d) => `zapisano arkusz ${n} — ${d}` },
      verifiable: true,
      source: "builtin",
    }),
    K({
      name: "generate_image",
      kind: "produces",
      running: "Rysuję obraz",
      ok: "Narysowałem",
      argName: "name",
      argPath: "name",
      group: {
        key: "obraz",
        verb: "narysowałem",
        countable: ["obraz", "obrazy", "obrazów"],
        weight: 5,
      },
      evidence: { list: "produced", phrase: (n) => `wygenerowano ${n}` },
      source: "builtin",
    }),
    K({
      // Świadomie BEZ `grupa`: sprawdzenie niesie stopka dowodu i plakietka przy pliku,
      // a w zdaniu podsumowania wypychałoby rzeczy, które człowiek chce zobaczyć.
      name: "verify_document",
      kind: "verifies",
      running: "Sprawdzam po zapisie",
      ok: "Sprawdziłem po zapisie",
      argName: "name",
      argPath: "name",
      evidence: { list: "produced", phrase: (n, d) => `odczytano ${n} po zapisie — ${d}` },
      source: "builtin",
    }),
    K({
      name: "run_computation",
      kind: "computes",
      running: "Liczę",
      ok: "Policzyłem",
      argDetail: "description",
      group: { key: "liczenie", verb: "policzyłem", weight: 4 },
      evidence: { list: "produced", phrase: (_n, d) => `policzono — ${d}` },
      source: "builtin",
    }),
    K({
      name: "save_to_my_files",
      kind: "stores",
      running: "Odkładam do Moich plików",
      ok: "Odłożyłem do Moich plików",
      argName: "name",
      argPath: "target",
      group: {
        key: "odlozone",
        verb: "odłożyłem",
        countable: ["plik", "pliki", "plików"],
        suffix: "do Moich plików",
        weight: 5,
      },
      evidence: { list: "produced", phrase: (_n, d) => `odłożono do Moich plików: ${d}` },
      source: "builtin",
    }),
  ].map((k) => [k.name, k]),
)

/** Rejestr rozszerzalny w czasie działania — tędy wejdą narzędzia z zatwierdzonych serwerów MCP. */
const extra = new Map<string, ToolCard>()

export function registerCard(k: ToolCard) {
  extra.set(k.name, k)
}

/** Nazwa serwera z klucza `mcp_<serwer>_<narzedzie>`; dla reszty — pusto. */
function serverFromKey(name: string): string | null {
  return /^mcp_([a-z0-9]+)_/.exec(name)?.[1] ?? null
}

/**
 * Karta ZAWSZE istnieje. Dla nieznanego narzędzia budujemy ją tak, żeby przebieg i dowód
 * powiedziały prawdę: że coś się wydarzyło, że pochodziło z zewnątrz i od kogo.
 * Etykieta w zdarzeniu jest nasza — pisze ją nasz kod przy wywołaniu, nie obcy serwer.
 */
export function cardFor(name: string, sourceFromEvent?: string): ToolCard {
  const known = extra.get(name) ?? TOOL_CARDS[name]
  if (known) return known

  // Nazwa źródła przychodzi w zdarzeniu, bo rejestr `registerCard` żyje w procesie
  // serwera, a przebieg i dowód rysuje przeglądarka. Prefiks klucza to ostatnia deska
  // ratunku — nie rozróżni serwera `vat-registry` od `vat`.
  const server = sourceFromEvent ?? serverFromKey(name)
  const source = server ?? "poza katalogiem"
  return {
    name,
    kind: "external",
    running: server ? `Odpytuję ${server}` : "Wykonuję czynność spoza katalogu",
    ok: server ? `Odpytałem ${server}` : "Wykonałem czynność spoza katalogu",
    group: {
      key: `zewnetrzne:${source}`,
      verb: server ? `odpytałem ${server}` : "wykonałem",
      countable: ["raz", "razy", "razy"],
      weight: 4,
    },
    evidence: {
      // Osobna lista, nie „Co zrobione" i nie „Co weszło": `ok: true` z obcego serwera
      // znaczy „odpowiedział", a nie „rzecz się wydarzyła". Nazwanie tego sprawdzonym
      // byłoby dokładnie tym, przed czym ten produkt ma bronić.
      list: "external",
      phrase: (_n, d, k) => `${source}: ${k?.label || name}${d ? ` — ${d}` : ""}`,
    },
    source,
  }
}

/** Czy po tej czynności w teczce naprawdę przybywa plik. */
export const producesFile = (name: string) =>
  cardFor(name).kind === "produces" || cardFor(name).kind === "stores"
