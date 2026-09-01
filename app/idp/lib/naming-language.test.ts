// Strażnik języka nazw: kod tego repozytorium pisze się po ANGIELSKU.
//
// DLACZEGO POWSTAŁ. Reguła istniała tu wyłącznie w przykładach — `architecture_rules.md`
// §13 opisuje `kebab-case`, `PascalCase` i prefiksy, ale ani słowem nie mówi o języku.
// Skutek: cały moduł Biurka (kafelek `desk`) powstał po polsku „od środka" i nikt tego
// nie zatrzymał, bo nie było czego złamać. Wzór to sweatshop, gdzie ta sama reguła jest
// niezmiennikiem 12 w `AGENTS.md` i ma bramkę (`Typos`) w łańcuchu `./build.sh`.
//
// CO ZOSTAJE PO POLSKU — to nie jest wyjątek, tylko druga połowa reguły: wszystko, co
// czyta CZŁOWIEK. Napisy na ekranie, komunikaty, opisy zdolności, treść dziennika,
// prompty do modelu, komentarze, dokumenty i — świadomie — scenariusze BDD, bo to nimi
// weryfikujemy produkt i mają być czytelne dla nas. Ta sama granica co w sweatshopie
// („dokumenty, ADR-y i Gherkin po polsku").
//
// CZEGO TEN STRAŻNIK NIE ZŁAPIE, powiedziane wprost, żeby nikt nie brał go za szczelny:
// napisów utrwalonych w bazie i w `payload` zdarzeń, które pełnią rolę identyfikatorów,
// a nie stoją w pozycji rozpoznawanej przez `DISCRIMINANT_PROPERTIES`. Ta klasa problemu
// jest realna i duża (typy dziennika, stany spraw, klucze pól zdarzeń) — pilnuje jej
// projekt przemianowania, nie ten plik.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

/**
 * Słowa zakazane w nazwach — KUROWANE RĘCZNIE, nie wygenerowane.
 *
 * Punktem wyjścia był zbiór 222 członów wyciągniętych z ówczesnego stanu Biurka.
 * Automat wciąga jednak człony neutralne albo wprost angielskie, a zakaz takiego słowa
 * czyni bramkę niemożliwą do włączenia. ODRZUCONE i dlaczego:
 *
 *   `api`, `app`, `bin`, `cn`, `core`, `db`, `desk`, `dialog`, `dom`, `event`, `get`,
 *   `layout`, `lib`, `max`, `menu`, `merge`, `meta`, `min`, `node`, `only`, `package`,
 *   `page`, `patch`, `pool`, `post`, `reset`, `route`, `sandbox`, `seed`, `server`,
 *   `src`, `stop`, `test`, `toast`, `ui`, `use` — to są słowa angielskie;
 *   `do`, `to`, `ma`, `ja`, `t`, `w`, `z`, `ze`, `zl` — za krótkie, dają fałszywe
 *   trafienia w angielskich nazwach;
 *   `persona` — funkcjonuje też jako słowo angielskie;
 *   nazwy bibliotek (`react`, `next`, `zod`, `lucide`, `playwright`, `tailwind`,
 *   `typescript`, `openai`, `pg`, `clsx`, `sdk`) — cudze, nie nasze.
 *
 * Lista jest OTWARTA: dopisz słowo, gdy zobaczysz je w nazwie i będzie polskie.
 */
const BANNED_WORDS = new Set([
  "adres",
  "akcja",
  "akcje",
  "argumenty",
  "artefakty",
  "awaria",
  "awatar",
  "baza",
  "bialej",
  "binarnie",
  "biurko",
  "blad",
  "brama",
  "cofnij",
  "czas",
  "czasownik",
  "czesci",
  "czytaj",
  "czytelny",
  "dane",
  "decyzja",
  "detal",
  "docelowy",
  "dodaj",
  "dodatkowe",
  "dolny",
  "dopisz",
  "dostawca",
  "dowod",
  "dryf",
  "dzial",
  "dziennik",
  "dzisiaj",
  "eksplorator",
  "etykieta",
  "fraza",
  "grupa",
  "grupe",
  "higiena",
  "ikona",
  "imie",
  "inna",
  "inne",
  "jest",
  "kandydaci",
  "kandydat",
  "kanoniczny",
  "karta",
  "karte",
  "karty",
  "katalog",
  "katalogi",
  "katalogu",
  "kiedy",
  "klasa",
  "klient",
  "klodka",
  "klucz",
  "kolejnosc",
  "kolizja",
  "komu",
  "kopiuj",
  "kosz",
  "kosza",
  "koszt",
  "krok",
  "kroki",
  "kroku",
  "krotko",
  "kto",
  "liczone",
  "limity",
  "lista",
  "listy",
  "migracja",
  "montaz",
  "mysl",
  "nadzor",
  "naglowki",
  "narzedzi",
  "narzedzia",
  "narzedzie",
  "nazwa",
  "nazwe",
  "nazwisko",
  "nazwy",
  "nowa",
  "nowy",
  "obietnice",
  "obraz",
  "obrazem",
  "obrot",
  "oczysc",
  "odcisk",
  "odmowa",
  "odrzucone",
  "odrzucony",
  "opis",
  "opisz",
  "ostatnie",
  "otwarty",
  "panelu",
  "paruj",
  "pasek",
  "pelna",
  "pelny",
  "piaskownica",
  "plik",
  "pliki",
  "pliku",
  "podglad",
  "podsumowanie",
  "podsumuj",
  "podziel",
  "pokaz",
  "pokrycia",
  "pole",
  "policz",
  "polityka",
  "polityki",
  "poprzednie",
  "potrafie",
  "powloka",
  "powod",
  "prosba",
  "prosby",
  "przebieg",
  "przejrzyj",
  "przenies",
  "przeniesienia",
  "przycisk",
  "przygotuj",
  "przyjete",
  "przywroc",
  "przyznane",
  "rola",
  "roli",
  "rozmiar",
  "schemat",
  "sciezka",
  "serwer",
  "serwerow",
  "serwery",
  "skad",
  "spraw",
  "sprawa",
  "sprawdzalny",
  "sprawy",
  "stan",
  "strony",
  "sufiks",
  "szczegol",
  "szczegoly",
  "szer",
  "teczka",
  "teczke",
  "tekst",
  "teraz",
  "tostow",
  "tozsamosc",
  "trasy",
  "tresc",
  "trwa",
  "tura",
  "ture",
  "typ",
  "typy",
  "tytul",
  "uchwyt",
  "uprawnien",
  "uruchom",
  "utworz",
  "utworzona",
  "uzytkownicy",
  "uzytkownik",
  "waga",
  "wgraj",
  "widok",
  "wiersz",
  "wlasciciel",
  "wpis",
  "wpisy",
  "wstrzymaj",
  "wybor",
  "wycofaj",
  "wydano",
  "wynik",
  "wyniki",
  "wytwarza",
  "wytworzone",
  "zablokowane",
  "zacisnij",
  "zalacznik",
  "zalacznika",
  "zalaczniki",
  "zalacznikow",
  "zamknij",
  "zapisz",
  "zasiej",
  "zatwierdz",
  "zatwierdzone",
  "zaznaczony",
  "zdalna",
  "zdarzen",
  "zdarzenia",
  "zdarzenie",
  "zdolnosc",
  "zdolnosci",
  "zlecenia",
  "zmien",
  "zmieniona",
  "zmieniony",
  "znana",
  "zrodlo",
  "zwin",
])

const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/

/**
 * ODROCZENIA — katalogi, których strażnik jeszcze nie pilnuje. DZIŚ: ŻADEN.
 *
 * Lista powstała razem ze strażnikiem i miała siedem pozycji — cały moduł Biurka.
 * Wszystkie zostały skreślone: kod, schemat bazy, wartości utrwalone w kolumnach
 * i w `payload`, adresy tras i nazwy narzędzi widziane przez model są po angielsku.
 *
 * Kluczem był KATALOG, nie plik, i to był wymóg, nie wygoda: w App Routerze plik
 * zawsze nazywa się `page.tsx` albo `route.ts`, więc ścieżką pliku nie dało się
 * wyrazić „ten katalog ma polską nazwę".
 *
 * Lista MOŻE TYLKO MALEĆ, a dziś jest pusta — czyli dopisanie czegokolwiek wymaga
 * zmiany także asercji niżej, więc świadomej decyzji, a nie jednej linijki w drodze
 * do zielonego testu.
 */
const DEFERRED_DIRS: string[] = []

/**
 * Pliki scenariuszy BDD są poza zasięgiem CAŁKOWICIE, nie przez odroczenie. Ich treść to
 * język wymagań i zostaje po polsku na stałe — razem z nazwami zmiennych pomocniczych,
 * które te wymagania opisują.
 */
const SCENARIO_FILES = /\.spec\.ts$|\/e2e\//

const SKIPPED_DIRS = ["node_modules", ".next", ".next-dev", "dist", "gen", "paraglide", "mocks"]

/** Właściwości, których wartość jest PROZĄ dla człowieka albo promptem dla modelu. */
const PROSE_PROPERTIES = new Set([
  "description",
  "opis",
  "krotko",
  "etykieta",
  "trwa",
  "ok",
  "fraza",
  "czasownik",
  "tytul",
  "podpowiedz",
  "tresc",
  "label",
  "placeholder",
  "title",
  "message",
  "tekst",
  "powod",
  "podsumowanie",
  "nazwa",
  "name",
  "systemPrompt",
  "userPrompt",
])

/**
 * Nazwy, które NIE SĄ nazwami w naszym kodzie, choć składniowo nimi są. Dwa przypadki:
 *
 *  1. klucz mapy jest CUDZĄ wartością — przychodzi z backendu i tłumaczenie go zrywa
 *     dopasowanie po cichu;
 *  2. klucz jest polem DOKUMENTU, który wychodzi do człowieka — eksport JSON z raportu
 *     zużycia czyta polska księgowość, więc jego pola nazywają się po polsku celowo.
 *
 * Per plik I per nazwa, nigdy per katalog: nowa polska nazwa w tym samym pliku dalej
 * jest czerwona. Ten sam układ, co `NOT_UI_TEXT` w `no-plain-text.test.ts`.
 */
const KEYS_OUTSIDE_OUR_CODE: Record<string, string[]> = {
  // Stopnie restrykcyjności przysyłane przez backend IDP, mapowane na klucze i18n.
  "app/idp/app/(main)/invoice-supervisor/policies/page.tsx": ["mała", "średnia", "duża"],
  "app/idp/components/invoice-supervisor/policy-form-dialog.tsx": ["mała", "średnia", "duża"],
  // Rodzaje klienta, tak jak nazywa je backend faktur.
  "app/idp/lib/invoice-supervisor/types.ts": ["nowy", "stały", "nazwa_klienta", "nazwa_sprzedawcy"],
  // Nazwa kategorii na hubie — klucz mapy jest ETYKIETĄ, którą widzi użytkownik.
  "app/idp/lib/tiles.ts": ["Treści", "Tekst"],
  "app/idp/components/ai-tools/ai-tools-dashboard.tsx": ["Treści", "Tekst"],
  // Rodzaj dokumentu przysyłany przez backend IDP.
  "app/idp/components/idp-basic/document-preview-panel.tsx": ["przewoźnik"],
  // Pola eksportu JSON, który otwiera księgowość — przypadek 2.
  "app/idp/lib/token-usage/csv.ts": ["uzytkownicy", "podsumowanie", "szczegoly"],
}

/** Właściwości, których wartość jest IDENTYFIKATOREM, choć bywa napisem. */
const DISCRIMINANT_PROPERTIES = new Set([
  "typ",
  "klasa",
  "lista",
  "klucz",
  "zrodlo",
  "skad",
  "kind",
])

function listSources(root: string): string[] {
  return readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => !SKIPPED_DIRS.some((part) => file.includes(`/${part}/`)))
    .filter((file) => !SCENARIO_FILES.test(file))
    .filter((file) => !DEFERRED_DIRS.some((dir) => file.startsWith(dir)))
}

const scanned = [...listSources("app"), ...listSources("apps"), ...listSources("packages")]

/** Rozbija identyfikator na człony: `zapiszDokument` → `zapisz`, `dokument`. */
const segments = (text: string): string[] =>
  text.match(/[A-Z]+(?![a-z])|[A-Z][a-z]+|[a-z]+/g)?.map((part) => part.toLowerCase()) ?? []

const offences = (text: string): string[] => {
  if (DIACRITICS.test(text)) return [`diakrytyk w nazwie: ${text}`]
  return segments(text)
    .filter((part) => BANNED_WORDS.has(part))
    .map((part) => `polskie słowo „${part}” w nazwie: ${text}`)
}

function parse(relative: string): ts.SourceFile {
  return ts.createSourceFile(
    relative,
    readFileSync(path.join(repoRoot, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

/** Nazwy, które ten plik DEKLARUJE — cudzych importów nie sądzimy. */
function declaredNames(source: ts.SourceFile): string[] {
  const collected: string[] = []
  const take = (node: ts.Node | undefined) => {
    if (node && ts.isIdentifier(node)) collected.push(...offences(node.text))
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) return // cudzy kod nazywa się, jak chce
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertySignature(node)
    ) {
      take(node.name)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) take(node.name)
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) take(node.name)
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) take(node.name)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return collected
}

/**
 * Napisy stojące w pozycji identyfikatora — wartość pola dyskryminującego.
 *
 * Rozważone i ODRZUCONE: napis jako KLUCZ obiektu. Brzmi podobnie, ale w tym repozytorium
 * klucze bywają etykietami do wyświetlenia (mapa kategorii w `lib/tiles.ts` ma klucz
 * „Treści"), więc reguła dawałaby fałszywe trafienia dokładnie tam, gdzie polszczyzna
 * jest poprawna.
 */
function identifierLikeStrings(source: ts.SourceFile): string[] {
  const collected: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(source).replace(/["']/g, "")
      if (
        DISCRIMINANT_PROPERTIES.has(key) &&
        !PROSE_PROPERTIES.has(key) &&
        ts.isStringLiteralLike(node.initializer)
      ) {
        collected.push(...offences(node.initializer.text).map((o) => `${o} (pole ${key})`))
      }
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return collected
}

describe("kod pisze się po angielsku", () => {
  it("skan obejmuje realny zbiór plików, a nie pusty", () => {
    // Bez tej asercji zaostrzenie filtra albo literówka w `SKIPPED_DIRS` dałaby
    // triumfalnie zielony test, który nie sprawdza niczego.
    expect(scanned.length).toBeGreaterThan(100)
  })

  it("nie ma już ani jednego odroczenia", () => {
    // Skreślenie wiersza z tej listy było pracą, nie formalnością: siedem katalogów
    // Biurka przeszło przemianowanie razem ze schematem bazy i danymi. Dopisanie
    // czegokolwiek tutaj wymaga zmiany TEJ asercji — i to jest cała jej rola.
    expect(DEFERRED_DIRS).toEqual([])
  })

  // JEDEN przypadek na katalog, nie jeden na plik. `it.each` po tysiącu plików wygląda
  // dokładniej, ale sygnał jest ten sam (komunikat i tak wymienia pliki po nazwie), za to
  // tysiąc dodatkowych przypadków przestawia kolejność całego biegu — i wywróciło osiem
  // testów cortex-coworka, które dzielą stan modułu i przechodziły tylko przy dotychczasowym
  // ułożeniu. Ich kruchość jest ich długiem; ten strażnik nie ma prawa go ujawniać kosztem
  // zielonego biegu.
  it.each(["app", "apps", "packages"])("nazwy w %s są po angielsku", (root) => {
    const offenders: Record<string, string[]> = {}
    for (const relative of scanned.filter((f) => f.startsWith(`${root}/`))) {
      const source = parse(relative)
      const found = [
        ...offences(relative.split("/").slice(0, -1).join("-")).map((o) => `${o} (katalog)`),
        ...offences(path.basename(relative).replace(/\.tsx?$/, "")).map(
          (o) => `${o} (nazwa pliku)`,
        ),
        ...declaredNames(source),
        ...identifierLikeStrings(source),
      ].filter(
        (o) => !(KEYS_OUTSIDE_OUR_CODE[relative] ?? []).some((key) => o.endsWith(`: ${key}`)),
      )
      if (found.length) offenders[relative] = [...new Set(found)]
    }
    expect(offenders).toEqual({})
  })
})

describe("strażnik naprawdę odrzuca polszczyznę", () => {
  // Test, który nie umie zapalić się na czerwono, nie jest bramką. Te przypadki sprawdzają
  // samą regułę na wejściu, którego w repozytorium nie ma.
  const inspect = (code: string) => {
    const source = ts.createSourceFile("probe.ts", code, ts.ScriptTarget.Latest, true)
    return [...declaredNames(source), ...identifierLikeStrings(source)]
  }

  it("czysta nazwa przechodzi", () => {
    expect(inspect("export function readFile(pathToFile: string) { return pathToFile }")).toEqual(
      [],
    )
  })

  it("diakrytyk w nazwie jest odrzucony", () => {
    expect(inspect("export const zaciśnij = 1")).toHaveLength(1)
  })

  it("polskie słowo ze słownika jest odrzucone", () => {
    expect(inspect("export function zapiszDokument() {}")[0]).toContain("zapisz")
  })

  it("napis w pozycji identyfikatora jest odrzucony, a jego treść nie", () => {
    const found = inspect('const e = { typ: "zdarzenie", label: "zapisz dokument w teczce" }')
    // jeden zarzut: WARTOŚĆ pola `typ`. Zdanie pod `label` jest prozą i przechodzi,
    // choć zawiera to samo słowo `zapisz` — o tym rozstrzyga pozycja, nie treść.
    expect(found).toEqual([
      "polskie słowo „typ” w nazwie: typ",
      "polskie słowo „zdarzenie” w nazwie: zdarzenie (pole typ)",
    ])
  })

  it("polska nazwa katalogu też się liczy", () => {
    expect(offences("apps-mcp-biala-lista")).not.toHaveLength(0)
  })
})
