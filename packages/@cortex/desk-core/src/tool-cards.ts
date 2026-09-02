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

/**
 * Człon podsumowania grupy. Człony o tym samym kluczu sumują się w jedno zdanie.
 *
 * `phrase` to KLUCZ SŁOWNIKA, a nie napis, i niesie CAŁY człon razem z liczbą:
 * „przeczytałem {{count}} pliki" / „read {{count}} files". Wcześniej stały tu trzy
 * osobne pola — czasownik, trzy formy rzeczownika i sufiks — sklejane w tej kolejności
 * w kodzie. To jest szyk polski; angielski składa to inaczej, a trzeci język jeszcze
 * inaczej. Jeden klucz z formami liczby mnogiej zostawia szyk słownikowi.
 */
export type ToolGroup = {
  key: string
  phrase: string
  /** przy skracaniu odpadają najpierw człony o najniższej wadze — dokument nigdy */
  weight: number
}

export type ToolCard = {
  name: string
  kind: ToolClass
  /**
   * KLUCZE SŁOWNIKA, nie zdania: „w toku" i „po zakończeniu". Zdanie powstaje przy
   * RENDERZE, a nie przy zapisie zdarzenia — dzięki temu ta sama sprawa czyta się
   * po polsku i po angielsku, bez przepisywania historii.
   */
  running: string
  ok: string
  /** który argument niesie nazwę rzeczy, a który pełną ścieżkę do szczegółu */
  argName?: string
  argPath?: string
  /**
   * Który argument niesie LISTĘ plików z biurka, które WESZŁY do sprawy — i jakim zdaniem
   * je zapisać w „Co weszło".
   *
   * To jest oś OSOBNA od `kind`. `kind` mówi, CZYM czynność jest; ta mówi, CO do sprawy
   * weszło. Zmieszanie ich dało błąd, który przez cały czas siedział w piaskownicy:
   * `run_computation` montuje pliki z biurka pod ich nazwami i liczy na nich, ale jest
   * klasy „computes", więc nie karmił `fromDesk`. Sprawa policzona w piaskownicy w całości
   * — czyli dokładnie ta, do której piaskownica służy — dostawała w panelu zdanie
   * „dokument powstał bez odczytania choćby jednego pliku z biurka". To była NIEPRAWDA
   * wypisana z powagą, w jedynym miejscu tego produktu, które nie ma prawa się mylić.
   *
   * Osobne pole, a nie druga wartość `kind`, bo obliczenie NIE jest odczytaniem: człowiek
   * ma widzieć, że plik wszedł do sprawy, i osobno — że wszedł jako dane, a nie jako lektura.
   */
  inputs?: { arg: string; phrase: string }
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
    /** klucz słownika; dostaje `name`, `detail`, `label` i `source` jako zmienne */
    phrase: string
    /**
     * Wariant tego samego zdania na wypadek, gdy narzędzie NIC nie podsumowało.
     * Wbudowane podsumowują zawsze, obce nie muszą — a zdanie ze szczegółem
     * dawałoby wtedy myślnik zawieszony w próżni: „nbp: kurs waluty — ".
     * Myślnik siedział wcześniej w warunku w kodzie; warunek jest częścią szyku,
     * więc idzie tam, gdzie reszta szyku, czyli do słownika.
     */
    phraseBare?: string
  }
  /**
   * Czy wytworzony plik podlega regule „zapisany, a nieodczytany po zapisie = NIESPRAWDZONY".
   * Obraz jej NIE podlega: nikt go po zapisie nie czyta, więc plakietka byłaby pochwałą bez pokrycia.
   */
  verifiable?: boolean
  /** skąd pochodzi — dla narzędzi MCP nazwa serwera, którą wpisał zatwierdzający */
  source: string
  /**
   * Zmienne wstawiane w KAŻDE zdanie tej karty. Istnieją dla narzędzi obcego serwera:
   * jego nazwa nie jest częścią klucza, tylko wartością, którą wpisał zatwierdzający.
   */
  vars?: Record<string, string>
}

const K = (k: ToolCard) => k

export const TOOL_CARDS: Record<string, ToolCard> = Object.fromEntries(
  [
    K({
      name: "list_files",
      kind: "browses",
      running: "tools.list_files.running",
      ok: "tools.list_files.ok",
      group: { key: "folder", phrase: "tools.groups.folder", weight: 1 },
      source: "builtin",
    }),
    K({
      name: "read_file",
      kind: "reads",
      running: "tools.read_file.running",
      ok: "tools.read_file.ok",
      argName: "path",
      argPath: "path",
      group: { key: "reading", phrase: "tools.groups.reading", weight: 3 },
      evidence: { list: "intake", phrase: "tools.evidence.read" },
      source: "builtin",
    }),
    K({
      /**
       * `reads`, tak samo jak `read_file` — bo dokument zbudowany wyłącznie z PDF-a MA się
       * liczyć jako wniesiona treść. Bez tego panel wypisywałby „dokument powstał bez
       * odczytania choćby jednego pliku z biurka” nad sprawą, w której cała treść przyszła
       * z faktury tej osoby.
       *
       * Ale osobna GRUPA i osobna FRAZA dowodu, mimo tej samej klasy. Wspólny klucz grupy
       * dałby zdanie „przeczytałem 2 pliki” o dwóch rzeczach, które są różne: jedna to
       * bajty z dysku, druga to odpowiedź modelu wizyjnego na obrazek strony. Ta różnica
       * jest całą treścią ADR-0001 §8 i człowiek ma ją widzieć w dowodzie, a nie dowiadywać
       * się o niej z dokumentacji.
       */
      name: "read_document",
      kind: "reads",
      running: "tools.read_document.running",
      ok: "tools.read_document.ok",
      argName: "path",
      argPath: "path",
      group: { key: "recognising", phrase: "tools.groups.recognising", weight: 3 },
      evidence: { list: "intake", phrase: "tools.evidence.recognised" },
      source: "builtin",
    }),
    K({
      name: "write_document",
      kind: "produces",
      running: "tools.write_document.running",
      ok: "tools.write_document.ok",
      argName: "name",
      argPath: "name",
      group: { key: "document", phrase: "tools.groups.document", weight: 5 },
      evidence: { list: "produced", phrase: "tools.evidence.wrote" },
      verifiable: true,
      source: "builtin",
    }),
    K({
      name: "write_sheet",
      kind: "produces",
      running: "tools.write_sheet.running",
      ok: "tools.write_sheet.ok",
      argName: "name",
      argPath: "name",
      // ten sam klucz co dokument: „zapisałem 2 dokumenty" zamiast dwóch osobnych członów
      group: { key: "document", phrase: "tools.groups.document", weight: 5 },
      evidence: { list: "produced", phrase: "tools.evidence.wroteSheet" },
      verifiable: true,
      source: "builtin",
    }),
    K({
      name: "generate_image",
      kind: "produces",
      running: "tools.generate_image.running",
      ok: "tools.generate_image.ok",
      argName: "name",
      argPath: "name",
      group: { key: "image", phrase: "tools.groups.image", weight: 5 },
      evidence: { list: "produced", phrase: "tools.evidence.generated" },
      source: "builtin",
    }),
    K({
      // Świadomie BEZ `group`: sprawdzenie niesie stopka dowodu i plakietka przy pliku,
      // a w zdaniu podsumowania wypychałoby rzeczy, które człowiek chce zobaczyć.
      name: "verify_document",
      kind: "verifies",
      running: "tools.verify_document.running",
      ok: "tools.verify_document.ok",
      argName: "name",
      argPath: "name",
      evidence: { list: "produced", phrase: "tools.evidence.verified" },
      source: "builtin",
    }),
    K({
      name: "run_computation",
      kind: "computes",
      inputs: { arg: "files", phrase: "tools.evidence.used" },
      running: "tools.run_computation.running",
      ok: "tools.run_computation.ok",
      argDetail: "description",
      group: { key: "computing", phrase: "tools.groups.computing", weight: 4 },
      evidence: { list: "produced", phrase: "tools.evidence.computed" },
      source: "builtin",
    }),
    K({
      // Świadomie BEZ `evidence`: propozycja NIE jest rzeczą, która się wydarzyła.
      // Wiersz w dowodzie mówiłby, że asystent coś zapamiętał — a on wyłącznie
      // poprosił człowieka, żeby mu na to pozwolił.
      name: "remember",
      kind: "browses",
      running: "tools.remember.running",
      ok: "tools.remember.ok",
      argDetail: "what",
      group: { key: "remember", phrase: "tools.groups.remember", weight: 2 },
      source: "builtin",
    }),
    K({
      name: "save_to_my_files",
      kind: "stores",
      running: "tools.save_to_my_files.running",
      ok: "tools.save_to_my_files.ok",
      argName: "name",
      argPath: "target",
      group: { key: "stored", phrase: "tools.groups.stored", weight: 5 },
      evidence: { list: "produced", phrase: "tools.evidence.stored" },
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
  const source = server ?? "outside-catalogue"
  return {
    name,
    kind: "external",
    running: server ? "tools.external.running" : "tools.outside.running",
    ok: server ? "tools.external.ok" : "tools.outside.ok",
    group: {
      key: `external:${source}`,
      phrase: server ? "tools.groups.external" : "tools.groups.outside",
      weight: 4,
    },
    evidence: {
      // Osobna lista, nie „Co zrobione" i nie „Co weszło": `ok: true` z obcego serwera
      // znaczy „odpowiedział", a nie „rzecz się wydarzyła". Nazwanie tego sprawdzonym
      // byłoby dokładnie tym, przed czym ten produkt ma bronić.
      list: "external",
      phrase: "tools.evidence.external",
      phraseBare: "tools.evidence.externalBare",
    },
    source,
    vars: { server: source },
  }
}

/** Czy po tej czynności w teczce naprawdę przybywa plik. */
export const producesFile = (name: string) =>
  cardFor(name).kind === "produces" || cardFor(name).kind === "stores"
