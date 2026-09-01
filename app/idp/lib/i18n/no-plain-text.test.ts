import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

/**
 * ZAKAZ TEKSTU W KODZIE — egzekwowany maszynowo, nie dyscypliną.
 *
 * Cel postawiony przez Alexa brzmi „nigdzie nie może być plain textu". Bez
 * tego testu jest to postanowienie, a nie własność: napis dopisany w pośpiechu
 * nie odróżnia się od reszty niczym, co dałoby się zobaczyć na przeglądzie.
 *
 * SKANUJE ŹRÓDŁO, NIE RENDER, i to jest istotne — render pokrywa wyłącznie
 * ekrany, które ktoś zamontował w teście, a napis w rzadkiej gałęzi błędu
 * przechodzi wtedy niezauważony.
 *
 * PARSUJE, ZAMIAST DOPASOWYWAĆ WZORCEM. Pierwsza wersja szukała tekstu JSX
 * wyrażeniem `>(…)<` i czytała przez to generyki TypeScriptu
 * (`React.ComponentPropsWithoutRef<typeof X>`) oraz odłamki wyrażeń (`) : (`)
 * jako napisy dla użytkownika. Przy regule zawężonej do polskich znaków
 * diakrytycznych te śmieci były niewidoczne, więc wzorzec wydawał się
 * wystarczać. Przy regule niezależnej od języka dawały setki fałszywych
 * trafień i test byłby nie do utrzymania. Parser rozróżnia tekst JSX od kodu
 * z definicji, a `typescript` i tak jest w repo.
 *
 * Komentarze nie wymagają wycinania — parser nie zalicza ich do żadnego
 * z badanych węzłów. Zostają po polsku świadomie: są dla nas, nie dla
 * użytkownika.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")

/**
 * NIE MA JUŻ LISTY WYJĄTKÓW DLA KATALOGÓW.
 *
 * Była, miała „dążyć do zera" i doszła — skan obejmuje teraz KAŻDY plik `.tsx`
 * w `app/` i `packages/`. Skasowana świadomie: dopóki istniała, dopisanie
 * katalogu było najprostszym sposobem na zielony test, a to dokładnie ta
 * furtka, przez którą pięć kafelków przeleżało miesiące po angielsku.
 * Wyjątek zostaje możliwy wyłącznie punktowo, przez `NOT_UI_TEXT` niżej —
 * per plik I per treść, więc nowa etykieta w tym samym pliku nadal jest czerwona.
 */

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/

/**
 * Nazwy własne i identyfikatory, które zostają nietknięte w każdym języku.
 *
 * Wzorzec, a nie wpis per plik, jest tu WŁAŚCIWY: nazwa produktu ma zostać
 * nazwą produktu wszędzie, więc przepuszczenie jej globalnie niczego nie
 * ukrywa. Odwrotnie niż `NOT_UI_TEXT` niżej, gdzie wzorzec przepuszczałby to
 * samo słowo także tam, gdzie jest już prawdziwą etykietą.
 */
const ALLOWED = [
  /Cortex360/,
  /Cortex Cowork/,
  /Cortex Config/,
  /OpenWebUI/,
  /LinkedIn/,
  /Intrastat/,
  /Store-Pit/,
  /Gemini/,
  /Content Guru/,
  /Visual Guru/,
  /Meeting Guru/,
  /Ilustromat/,
  /Fakturomat/,
  /AI Tools/,
  /Incoterms/,
  /Huzar/,
]

/**
 * Napisy, które WYGLĄDAJĄ jak etykietę, ale nią nie są — wartość jadąca na
 * drut, identyfikator szablonu, fragment promptu do modelu, nazwa roli ARIA
 * albo legenda klawisza na klawiaturze.
 *
 * Wyjątek jest przypięty do PLIKU I TREŚCI, nie do wzorca. Wzorzec
 * przepuszczałby te same słowa wszędzie indziej; tak zapisany wyjątek
 * przestaje działać w chwili, gdy ktoś dopisze do tego samego pliku prawdziwą
 * etykietę. Uzasadnienie każdej pozycji stoi w komentarzu przy niej w kodzie.
 */
const NOT_UI_TEXT: Record<string, string[]> = {
  "app/idp/components/invoice-supervisor/policy-form-dialog.tsx": [
    "mała",
    "średnia",
    "duża",
    "surowa",
  ],
  "app/idp/components/invoice-supervisor/client-form-dialog.tsx": ["nowy", "stały", "vip"],
  "app/idp/components/transport-orders/transport-orders-panel.tsx": ["rusałka_connector_xml"],
  "app/idp/components/ai-tools/ai-tool-workspace.tsx": ["Użytkownik", "Asystent"],
  // Literał JSON-a renderowany dosłownie w podglądzie — `null` to wartość,
  // którą przeglądarka drzewa MA pokazać, nie etykieta interfejsu.
  "packages/@cortex/ui/src/components/json-viewer.tsx": ["null"],
  // Nazwa roli nawigacji z ARIA — kontrakt, nie napis: czytnik ekranu
  // oczekuje dokładnie tej wartości niezależnie od języka interfejsu.
  "packages/@cortex/ui/src/components/ui/breadcrumb.tsx": ["breadcrumb"],
  // `idp` to identyfikator kafelka; `Esc` to napis WYTŁOCZONY NA KLAWISZU —
  // legenda skrótu ma wskazywać fizyczny klawisz, więc tłumaczenie jej
  // rozjechałoby ją z klawiaturą użytkownika.
  "app/idp/components/command-palette.tsx": ["idp", "Esc"],
  // Proza, którą przysyła backend, użyta jako KLUCZ dopasowania. Zmiana
  // choćby znaku zrywa dopasowanie po cichu; napis widoczny bierze się
  // z klucza po prawej stronie mapy.
  "app/idp/components/idp-basic/status.tsx": [
    "Brak CMR",
    "Brak POD",
    "Brak faktury kosztowej",
    "Brak zlecenia transportowego",
    "Nie znaleziono numeru referencyjnego",
    "Dokument nierozpoznany:",
    "Niska pewność klasyfikacji:",
    "CMR zawiera uwagę lub zastrzeżenie:",
    "Niepełna analiza po maksymalnym zakresie:",
    "Pominięto nieobsługiwany plik:",
  ],
  // Nazwy pól schematu SAD/Huzar — identyfikatory formatu wymiany, po których
  // rozpoznaje je agent celny; przetłumaczone rozjechałyby się z dokumentacją.
  "app/idp/components/transport-orders/sad-context-editor.tsx": [
    "PreviousDocuments",
    "AttachedDocuments",
  ],
  // Wartość POCZĄTKOWA kategorii nowego szablonu, zapisywana do bazy —
  // kategoriami zarządza użytkownik, więc to dana instancji, nie etykieta.
  "app/idp/app/(main)/content-guru/templates/page.tsx": ["Główne"],
  // Przykładowe wartości w podpowiedziach pól: nazwy zakresów i formatów
  // eksportu, które użytkownik wpisuje dosłownie.
  "app/idp/app/(main)/idp/configuration/page.tsx": [
    "export, rules",
    "csv_new, standard_xml, sad_xml",
  ],
  // Przykład wywołania narzędzia wiersza poleceń.
  "app/idp/features/cortex-config/components/connector-editor.tsx": ["--format json"],
}

const SKIP = ["node_modules", ".next", "mocks"]

/**
 * MODUŁY JEDNOJĘZYCZNE — jedyny wyjątek katalogowy w tym teście, i celowo
 * niepodobny do skasowanej listy wyjątków opisanej wyżej.
 *
 * Biurko (kafelek `desk`) nie ma warstwy tłumaczeń w ogóle: nie ma w nim ani
 * jednego `useTranslation`, ani jednego klucza, ani jednego pliku `locales`.
 * Jego treść to nie etykiety, tylko proza pisana pod jedną osobę — „Nie masz
 * jeszcze żadnej sprawy", „Pytałem poza firmą", „To nie jest Twój dzienny
 * limit". Wpisanie tych ~600 zdań do `NOT_UI_TEXT` udawałoby, że każde z nich
 * rozważono z osobna i uznano za nie-etykietę; żadne nie jest.
 *
 * Różnica wobec tamtej furtki jest w tym, CZEGO ten wyjątek dowodzi. Tamta
 * przepuszczała katalogi, które tłumaczenia MIAŁY i po prostu ich nie
 * zastosowały — więc znikał sygnał o niedokończonej robocie. Ten mówi:
 * „tego modułu nie ma jeszcze w zasięgu tłumaczeń". Jest to dług i tak jest
 * zapisany; wchodzi razem z decyzją o wielojęzyczności Biurka, nie wcześniej.
 *
 * Asercja niżej pilnuje, żeby lista nie urosła po cichu: dopisanie tu czegokolwiek
 * wymaga zmiany także tamtego oczekiwania, czyli świadomej decyzji, a nie jednej
 * linijki dopisanej w drodze do zielonego testu.
 */
const JEDNOJEZYCZNE = ["packages/@cortex/desk-ui/", "packages/@cortex/desk-app/"]

const jednojezyczny = (file: string) => JEDNOJEZYCZNE.some((prefix) => file.startsWith(prefix))

/** Atrybuty, których wartość czyta użytkownik albo czytnik ekranu. */
const LABEL_ATTRS = new Set([
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "alt",
  "label",
])

/**
 * Właściwości, których wartość jest INSTRUKCJĄ DLA MODELU, nie interfejsem.
 * Repo samo modeluje to typem `PromptPair`, więc reguła idzie za istniejącym
 * pojęciem, zamiast wpisywać całe zdania do listy wyjątków — a przy okazji
 * obejmuje każdy następny prompt, którego nikt nie będzie musiał zgłaszać.
 */
const PROMPT_PROPERTIES = new Set(["systemPrompt", "userPrompt"])

function insidePrompt(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isPropertyAssignment(current) && PROMPT_PROPERTIES.has(current.name.getText())) {
      return true
    }
  }
  return false
}

const COMPARISONS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
])

interface Found {
  value: string
  where: string
}

/** Tekst JSX i etykiety w atrybutach — to, co użytkownik realnie zobaczy. */
function jsxStrings(source: ts.SourceFile): Found[] {
  const found: Found[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, " ").trim()
      if (value) found.push({ value, where: "tekst JSX" })
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source)
      if (LABEL_ATTRS.has(name)) {
        // Schodzimy w CAŁE wyrażenie, nie tylko w goły literał: zapis
        // `aria-label={collapsed ? "Expand" : "Collapse"}` nie jest literałem
        // ani jednym napisem, a mimo to podaje czytnikowi ekranu dwa gotowe
        // zdania. Wersja czytająca wyłącznie `StringLiteral` na wierzchu
        // przepuszczała ten kształt w pasku górnym.
        const literals: ts.StringLiteral[] = []
        const collect = (n: ts.Node): void => {
          // Operand porównania NIE jest wynikiem wyrażenia, tylko warunkiem:
          // w `aria-label={sortOrder === "asc" ? … : …}` napisem dla czytnika
          // ekranu są gałęzie, a `"asc"` to wartość sortowania jadąca na drut.
          // Wersja zbierająca wszystkie literały zgłaszała tu fałszywy alarm.
          if (ts.isBinaryExpression(n) && COMPARISONS.has(n.operatorToken.kind)) {
            if (!ts.isStringLiteral(n.left)) collect(n.left)
            if (!ts.isStringLiteral(n.right)) collect(n.right)
            return
          }
          if (ts.isCaseClause(n)) {
            for (const statement of n.statements) collect(statement)
            return
          }
          if (ts.isStringLiteral(n)) literals.push(n)
          ts.forEachChild(n, collect)
        }
        collect(node.initializer)
        for (const literal of literals) {
          found.push({ value: literal.text, where: `atrybut ${name}` })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** Wszystkie literały poza ścieżkami importu — szerzej niż sam JSX, bo napis
 *  trafia do użytkownika także przez toast, etykietę kolumny czy `label:`
 *  w tablicy opcji, a żadne z tych miejsc nie jest węzłem JSX. */
function allStrings(source: ts.SourceFile): Found[] {
  const found: Found[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = node.text.trim()
      if (value && !insidePrompt(node)) found.push({ value, where: "literał" })
    } else if (ts.isTemplateExpression(node)) {
      if (insidePrompt(node)) return
      for (const span of [node.head, ...node.templateSpans.map((s) => s.literal)]) {
        const value = span.text.trim()
        if (value) found.push({ value, where: "literał szablonu" })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...found, ...jsxStrings(source)]
}

/**
 * Napis „dla człowieka": wielowyrazowy, zakończony znakiem zdania albo będący
 * pojedynczym SŁOWEM — same litery, co najmniej trzy znaki, nie same wersaliki.
 *
 * Ostatni warunek dołożony po pomiarze, nie z ostrożności. Wersja bez niego
 * przepuszczała 49 realnych etykiet w 23 plikach („Cancel", „Close", „Route",
 * „Wszystkie", „Funkcjonalnie") — w tym polskie słowa bez ani jednego ogonka,
 * na które reguła diakrytyczna też jest ślepa. Fałszywych trafień w tym
 * pomiarze były trzy i wszystkie trzy siedzą w `WIRE_VALUES`.
 *
 * Skróty i symbole zostają przepuszczone: `CMR`, `IMAP`, `PDF`, `kg`, `%`
 * i `⌘K` są w każdym języku takie same, a wymuszanie na nich klucza dołożyłoby
 * setki wpisów bez ani jednego tłumaczenia.
 */
function looksLikeLabel(value: string): boolean {
  // Bez litery nie ma czego tłumaczyć. Warunek wygląda na oczywisty, ale bez
  // niego samotna kropka rozdzielająca dwa elementy JSX („…{count}.") spełnia
  // regułę „kończy się znakiem zdania" i zgłasza się jako napis.
  if (!/[A-Za-zÀ-žĄ-ż]/.test(value)) return false
  if (/\s/.test(value) || /[.?!]$/.test(value)) return true
  return /^[A-Za-zÀ-žĄ-ż]{3,}$/.test(value) && value !== value.toUpperCase()
}

function listTsx(root: string): string[] {
  return readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => file.endsWith(".tsx"))
    .filter((file) => !file.endsWith(".test.tsx") && !file.endsWith(".stories.tsx"))
    .filter((file) => !SKIP.some((part) => file.includes(`/${part}/`)))
    .filter((file) => !jednojezyczny(file))
}

const files = [...listTsx("app"), ...listTsx("packages")]

/**
 * Pola, które w tym repo z konwencji trafiają na ekran.
 *
 * Reguła niżej istnieje, bo skan `.tsx` MA ŚLEPĄ PLAMĘ i kosztowała ona realny
 * błąd: `lib/board/pipeline.ts` sklejał `"${n} docs"` i `"Unassigned"` do pola
 * `subtitle`, które renderowało się na karcie kanbana. Plik `.ts` nie zawiera
 * JSX, więc żadna z dwóch pozostałych reguł nie mogła go zobaczyć.
 *
 * Reguła jest WĄSKA celowo. Szeroka — „żaden literał w `.ts` nie może być po
 * polsku" — dała w pomiarze 374 trafienia w 72 plikach, i niemal wszystkie
 * słusznie: prompty do modeli, komunikaty do logów, klucze dopasowania prozy
 * z backendu, a nawet pangram „Zażółć gęślą jaźń" sprawdzający pokrycie
 * znaków w kroju pisma. Strażnik z siedemdziesięcioma wyjątkami przestaje być
 * strażnikiem i staje się listą.
 */
const UI_BOUND_FIELDS = new Set([
  "label",
  "title",
  "subtitle",
  "description",
  "placeholder",
  "hint",
  "emptyMessage",
  "tooltip",
])

/**
 * Pliki `.ts`, w których napis w takim polu jest DANĄ, nie interfejsem.
 * Każda pozycja to kategoria, nie pojedynczy wyjątek.
 */
const DATA_NOT_UI = [
  // Manifest niesie wartości POCZĄTKOWE wiersza w `system_config.applications`,
  // wpisywane przy pierwszym INSERCIE; w runtime właścicielem jest admin.
  /manifest\.ts$/,
  // Rejestry kafelków i narzędzi AI: wartość w języku źródłowym, tłumaczenie
  // w pozostałych bierze `i18n/tile-names.ts` z przestrzeni `tiles`.
  "app/idp/lib/tiles.ts",
  "app/idp/lib/ai-tools/registry.ts",
  // Nazwy własne presetów wyglądu.
  "app/idp/lib/presets/registry.ts",
  // Dane demo: nazwy produktów i kontrahentów, nie interfejs.
  /dataset\.ts$/,
  // Dane startowe instancji — własność admina po pierwszym uruchomieniu.
  "app/idp/lib/cortex-governance/store.ts",
  // Przykładowe tematy WEWNĄTRZ promptu do modelu.
  "app/idp/lib/ilustromat/prompt-builder.ts",
  // Pola `description` narzędzi agenta (Vercel AI SDK) — to jest PROMPT, czytany
  // przez model, nie etykieta czytana przez człowieka. Na ekran idą osobne
  // czasowniki z kart narzędzi (`tool-cards.ts`), i to one są napisem.
  "packages/@cortex/desk-core/src/runtime.ts",
  // Ta sama kategoria dla narzędzi z serwerów MCP: `description` to opis, który
  // zatwierdzający napisał DLA MODELU i który wchodzi do odcisku zgody, a `label`
  // to nazwa serwera wpisana przez przełożonego — dana instancji, nie interfejs.
  "packages/@cortex/desk-core/src/mcp/catalogue.ts",
  "packages/@cortex/desk-core/src/mcp/client.ts",
]

function listTs(root: string): string[] {
  return readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".stories.ts"))
    .filter((file) => !SKIP.some((part) => file.includes(`/${part}/`)))
    .filter((file) => !jednojezyczny(file))
    .filter(
      (file) =>
        !DATA_NOT_UI.some((rule) => (typeof rule === "string" ? file === rule : rule.test(file))),
    )
}

const tsFiles = [...listTs("app"), ...listTs("packages")]

/** Napisy przypisane do pól, które z konwencji trafiają na ekran. */
function uiBoundStrings(source: ts.SourceFile): Found[] {
  const found: Found[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      UI_BOUND_FIELDS.has(node.name.getText(source).replace(/['"]/g, "")) &&
      !insidePrompt(node)
    ) {
      const name = node.name.getText(source)
      const init = node.initializer
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        found.push({ value: init.text, where: `pole ${name}` })
      } else if (ts.isTemplateExpression(init)) {
        const joined = [init.head, ...init.templateSpans.map((s) => s.literal)]
          .map((part) => part.text)
          .join(" ")
        found.push({ value: joined, where: `pole ${name} (szablon)` })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** `ScriptKind.TSX` także dla `.ts`: parser TSX czyta zwykły TypeScript bez
 *  zastrzeżeń, a jedna ścieżka jest mniej podatna na pomyłkę niż dwie. */
function parse(relative: string): ts.SourceFile {
  return ts.createSourceFile(
    relative,
    readFileSync(path.join(repoRoot, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

function exempt(relative: string, value: string): boolean {
  if (ALLOWED.some((allowed) => allowed.test(value))) return true
  return (NOT_UI_TEXT[relative] ?? []).includes(value)
}

describe("zakaz tekstu w kodzie", () => {
  it("skan obejmuje realny zbiór plików, a nie pusty", () => {
    // Bez tej asercji zaostrzenie filtra albo literówka w `SKIP` dałaby
    // triumfalnie zielony test, który nie sprawdza niczego.
    expect(files.length).toBeGreaterThan(5)
  })

  it("wyjątek jednojęzyczny obejmuje wyłącznie Biurko", () => {
    expect(JEDNOJEZYCZNE).toEqual(["packages/@cortex/desk-ui/", "packages/@cortex/desk-app/"])
  })

  it.each(files)("%s nie zawiera napisu po polsku", (relative) => {
    const offenders = allStrings(parse(relative))
      .filter(({ value }) => POLISH.test(value) && !exempt(relative, value))
      .map(({ value, where }) => `${where}: ${value}`)

    expect({ [relative]: offenders }).toEqual({ [relative]: [] })
  })

  /**
   * Reguła NIEZALEŻNA OD JĘZYKA — druga połowa celu i ta, której brakowało.
   *
   * Reguła wyżej pilnuje polskich znaków diakrytycznych, więc z definicji nie
   * widzi dwóch klas napisów: ekranów napisanych od razu po angielsku (całe
   * kafelki: intrastat, store-pit, idp-basic) i polszczyzny, która akurat
   * żadnego ogonka nie ma („Wszystkie aplikacje", „Nie znaleziono aplikacji").
   * Obie klasy przechodziły przez bramkę tygodniami.
   */
  it("skan plików .ts obejmuje realny zbiór, a nie pusty", () => {
    expect(tsFiles.length).toBeGreaterThan(50)
  })

  /**
   * Trzecia reguła — dla plików `.ts`, w których nie ma JSX-a, więc reguła
   * wyżej ich nie dotyczy. Uzasadnienie i granice przy `UI_BOUND_FIELDS`.
   */
  it.each(tsFiles)("%s nie przypisuje napisu do pola widocznego na ekranie", (relative) => {
    const offenders = uiBoundStrings(parse(relative))
      .filter(({ value }) => looksLikeLabel(value) && !exempt(relative, value))
      .map(({ value, where }) => `${where}: ${value}`)

    expect({ [relative]: offenders }).toEqual({ [relative]: [] })
  })

  it.each(files)("%s nie zawiera zdania wpisanego wprost w JSX", (relative) => {
    const offenders = jsxStrings(parse(relative))
      .filter(({ value }) => looksLikeLabel(value) && !exempt(relative, value))
      .map(({ value, where }) => `${where}: ${value}`)

    expect({ [relative]: offenders }).toEqual({ [relative]: [] })
  })
})
