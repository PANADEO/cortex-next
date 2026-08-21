import { z } from "zod"

// `kind` to jedyna dozwolona odpowiedź na "jak kafelek jest hostowany".
// native       — strona w tym Next.js app (patrz code-tile).
// external-link — link/target=_blank do zewnętrznego serwisu (np. OpenWebUI).
// iframe        — jak wyżej, ale osadzone w chrome shellu (Faza 2, jeszcze nieużywane).
export const TileKind = z.enum(["native", "external-link", "iframe"])
export type TileKind = z.infer<typeof TileKind>

// Trzy zamknięte listy wartości prezentacyjnych. Są KOPIĄ list, które żyją po
// stronie aplikacji: TileCategoryFunctional/TileCategoryDepartment z
// app/idp/lib/tiles.ts i klucze TILE_COLORS z
// app/idp/features/system-config/colors.ts. Parzystości pilnuje test
// (app/idp/lib/tile-presentation-parity.test.ts) — ten sam układ co APPLICATION_KINDS
// w @cortex/db, które tak samo dubluje TileKind pod okiem testu. Kopia, a nie
// import, bo kierunek zależności zabrania odwrotnego: tile-sdk jest liściem,
// app/idp importuje z niego, nie na odwrót.
//
// Rozważone i odrzucone: `z.string()`, jak w applicationFieldsSchema
// (@cortex/service). Tam enum jest świadomie NIE dublowany, bo zamkniętą listę
// egzekwuje formularz (select/multi-select) — na ścieżce manifestu żadnego
// formularza nie ma, więc nie pilnowałoby jej nic. A literówka w tych polach
// nie daje błędu, tylko cichą degradację: kafelek wypada ze wszystkich
// zakładek kategorii (tileBelongsTo) albo dostaje szarą ikonę (resolveTileColor
// spada na "slate"). To jest ta sama klasa cichego zniknięcia, przed którą
// chroni już walidacja `entitlementCode`/`route` niżej.
export const TileColor = z.enum([
  "rose",
  "sky",
  "cyan",
  "indigo",
  "amber",
  "emerald",
  "violet",
  "slate",
  "teal",
  "orange",
  "blue",
])
export type TileColor = z.infer<typeof TileColor>

/** Oś "Funkcje" na hubie (w UI: "Kategoria funkcjonalna"). */
export const TileCategoryFunctional = z.enum([
  "content-generation",
  "agents",
  "research",
  "misc",
  "admin-system",
])
export type TileCategoryFunctional = z.infer<typeof TileCategoryFunctional>

/** Oś "Działy" na hubie (w UI po prostu "Kategoria") — wielowartościowa. */
export const TileCategoryDepartment = z.enum(["operations", "marketing", "finance", "it", "hr"])
export type TileCategoryDepartment = z.infer<typeof TileCategoryDepartment>

/** Adres zewnętrzny musi być realnym linkiem HTTP(S). `z.string().url()` tego
 *  NIE pilnuje — przepuszcza `javascript:`/`data:`/`file:`, czyli uśpiony stored
 *  XSS na moment, w którym rejestr zacznie zasilać nawigację.
 *  Przeniesione z @cortex/service (PROJECT/cortex-frontend-hub-db-driven-projekt.md
 *  D10-rewizja a) — tile-sdk jest teraz jedynym miejscem, `service` importuje z powrotem. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/** Ścieżka natywna musi być ścieżką W TEJ aplikacji: jeden wiodący ukośnik,
 *  bez `//evil.com` (protocol-relative), bez `/\evil.com` (część przeglądarek
 *  traktuje backslash jak ukośnik) i bez pełnych URL-i — inaczej rejestr staje
 *  się open redirectem. */
export function isInternalRoute(value: string): boolean {
  return /^\/(?![/\\])\S*$/.test(value)
}

// Rozszerzenie o `route` (PROJECT/cortex-frontend-hub-db-driven-projekt.md
// D10-rewizja a): kafelki natywne nie miały dotąd w manifeście pola na trasę,
// mimo że to one są jedynym przypadkiem, który D6-rewizja musi obsłużyć —
// manifest jest DOWODEM, że kod istnieje, `route` jest częścią tego dowodu.
export const TileManifestSchema = z
  .object({
    id: z.string().min(1),
    kind: TileKind,
    label: z.string().min(1),
    // Ten sam regex/limit co `applications.code` w bazie (unique index + CHECK) —
    // walidacja tutaj, w miejscu gdzie deweloper pisze manifest, daje czytelny
    // błąd defineTile() zamiast błędu Postgresa dopiero przy deployu.
    entitlementCode: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "entitlementCode może zawierać tylko małe litery, cyfry i myślnik"),
    url: z.string().url().optional(),
    route: z.string().optional(),
    // Czym ten kod JEST, a nie jak się renderuje (K1b — §4 "Ryzyka" w tym
    // samym dokumencie co niżej i §5 "Dwie rzeczy do przeniesienia uważnie" w
    // towarzyszącym mu ...-implementacja.md). Cztery
    // kody w rejestrze nie są kafelkami, tylko uprawnieniami: `ai-tools` i
    // `cortex-cowork` (granty zbiorcze — kod sam nigdy nie renderuje własnej
    // karty, bramkuje rodzinę kafelków renderowaną gdzie indziej) oraz
    // `intrastat-cn-editor`/`intrastat-config-editor` (odblokowują przyciski
    // edycji WEWNĄTRZ kafelka Intrastat; realną egzekucją zajmuje się
    // zewnętrzny backend FastAPI).
    //
    // Dziś trzyma je poza hubem WYŁĄCZNIE `show_on_hub = excluded.show_on_hub`
    // w seed-system-config.mjs — czyli ta sama linia, którą K3 usuwa JAKO
    // DEFEKT (tą samą drogą wraca kategoria ustawiona przez admina). Po K3 nie
    // zostałoby nic, co mówi "to jest uprawnienie, nie kafelek", a
    // activateApplication() ustawiała dotąd `show_on_hub = true` bezwarunkowo
    // dla każdego wiersza `native` — więc pierwszy admin przechodzący przez
    // picker "Dodaj aplikację" na świeżej instancji (a przejść przez niego
    // MUSI, dla każdego prawdziwego kafelka) dostawałby cztery karty
    // prowadzące do ekranów, które kafelkami nie są.
    //
    // Nazwa celowo semantyczna, nie `showOnHub`: kolumna `show_on_hub` jest
    // KONSEKWENCJĄ tego faktu i w runtime należy do admina (może pokazać albo
    // schować dowolny kafelek), a sam fakt jest własnością kodu i nie zmienia
    // się nigdy. Manifest niosący wprost `showOnHub` sugerowałby czytelnikowi,
    // że seed synchronizuje tę kolumnę przy każdym deployu — czyli dokładnie
    // ten defekt, dla którego naprawy powstał ten projekt.
    //
    // `z.literal(true)`, nie `z.boolean()`: `entitlementOnly: false` znaczyłoby
    // to samo co pominięcie pola, a K1 odrzucił już dwa takie redundantne
    // zapisy (pusta tablica w `categoryDepartment`, pusty string w
    // `description`). Domyślną odpowiedzią jest "to jest kafelek": pole
    // zapomniane nie ma prawa ukryć prawdziwego kafelka, może najwyżej
    // wystawić uprawnienie — pomyłka widoczna, nie cicha.
    entitlementOnly: z.literal(true).optional(),
    // Wartości POCZĄTKOWE prezentacji (K1 z PROJECT/cortex-frontend/ARTIFACTS/
    // licencjonowanie/cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md,
    // D2). Manifest odpowiada na pytanie "skąd bierze się wartość początkowa",
    // NIE na "kto jest właścicielem wartości w runtime" — właścicielem jest
    // admin edytujący ją w UI. Dlatego seed-tile-manifests.mjs wstawia te pola
    // WYŁĄCZNIE na INSERCIE i nigdy w `do update set`; dopisanie ich tam
    // odtworzyłoby defekt, dla którego naprawy ten projekt powstał (kategorie
    // ustawione przez admina wracają przy każdym deployu).
    //
    // Wszystkie opcjonalne: odpowiadające kolumny w system_config.applications
    // są nullable (`sort_order` ma default), a wypełnienie 22 istniejących
    // manifestów to osobny krok (K2).
    //
    // Limit 500 = ten sam co `description` w applicationFieldsSchema
    // (@cortex/service), czyli druga ścieżka zapisu do tej samej kolumny.
    // `min(1)` — pusty literał w manifeście jest zawsze pomyłką: "brak opisu"
    // wyraża się pominięciem pola, nie pustym stringiem.
    description: z.string().min(1).max(500).optional(),
    // Nazwa ikony lucide-react (PascalCase), nie ścieżka do pliku; limit 64 jak
    // w applicationFieldsSchema. Zamknięta lista odpada świadomie — IconPicker
    // pozwala adminowi zapisać dowolną z ~3,5 tys. nazw katalogu, więc enum
    // byłby węższy niż to, co i tak trafia do kolumny. Regex łapie realną klasę
    // literówek ("scan-text", "lucide:ScanText"), które nie dają błędu, tylko
    // cichy fallback na LayoutDashboard w resolveApplicationIcon.
    icon: z
      .string()
      .max(64)
      .regex(
        /^[A-Z][A-Za-z0-9]*$/,
        "icon musi być nazwą ikony lucide-react w PascalCase, np. ScanText",
      )
      .optional(),
    color: TileColor.optional(),
    categoryFunctional: TileCategoryFunctional.optional(),
    // `min(1)`, bo pusta tablica i pominięcie pola znaczą w bazie to samo
    // ("kafelek bez działu"), a jedna z tych dwóch form jest zbędna.
    categoryDepartment: z.array(TileCategoryDepartment).min(1).optional(),
    // Pozycja startowa kafelka na hubie. Te same granice co `sortOrder` w
    // applicationFieldsSchema (@cortex/service): liczba całkowita 0..10000.
    // Kolumna jest `integer NOT NULL DEFAULT 0`, więc pominięcie pola oznacza
    // 0 — patrz seed-tile-manifests.mjs, który wstawia właśnie tę wartość
    // (nulla ta kolumna nie przyjmie).
    //
    // Pole istnieje, bo dziś ta wartość ma jedyne źródło w statycznej liście
    // APPLICATIONS (`index * 10`), którą usuwa K3: bez odpowiednika w
    // manifeście ŚWIEŻA baza dostałaby wszystkie kafelki z zerem i hub
    // ułożyłby je alfabetycznie po kodzie. Instancje już działające niczego by
    // nie zauważyły (`do update set` tej kolumny nie tyka), więc regresja
    // wyszłaby dopiero u nowego klienta i wyglądała na przypadek.
    //
    // INSERT-only jak reszta: deweloper PROPONUJE kolejność, układ huba należy
    // do admina i musi przeżyć deploy (D5). To NIE jest to samo co "nowy
    // wiersz zakładany z panelu ląduje na końcu listy" — tamto dotyczy
    // toApplicationValues() w @cortex/service i jest osobnym krokiem (K4).
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((tile) => tile.kind !== "native" || Boolean(tile.route), {
    message: "route wymagane dla kind='native'",
    path: ["route"],
  })
  .refine((tile) => tile.kind === "native" || Boolean(tile.url), {
    message: "url wymagane dla kind!=='native'",
    path: ["url"],
  })
  .refine((tile) => tile.kind !== "native" || !tile.url, {
    message: "kind='native' nie może mieć url",
    path: ["url"],
  })
  .refine((tile) => tile.kind === "native" || !tile.route, {
    message: "kind!=='native' nie może mieć route",
    path: ["route"],
  })
  .refine((tile) => !tile.route || isInternalRoute(tile.route), {
    message: "route musi być wewnętrzną ścieżką zaczynającą się od pojedynczego /",
    path: ["route"],
  })

export type TileManifest = z.infer<typeof TileManifestSchema>

// Jedyny sposób zdefiniowania kafelka — patrz .claude/skills/code-tile/SKILL.md.
// Rzuca przy błędnym manifeście zamiast cicho przepuszczać złe dane dalej.
export function defineTile(manifest: TileManifest): TileManifest {
  return TileManifestSchema.parse(manifest)
}
