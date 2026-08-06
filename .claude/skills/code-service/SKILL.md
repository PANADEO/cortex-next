---
name: code-service
description: Wewnętrzna warstwa serwisowa (logika biznesowa, RBAC/walidacja) w @cortex/service, importowana przez inne moduły — NIE przez HTTP. Użyj gdy trzeba sprawdzić uprawnienia, dodać regułę biznesową współdzieloną między kafelkami, albo pytasz "gdzie żyje logika X". NIE dla route handlerów app/api/**/route.ts (→ code-api) ani dla wywołań serwisów spoza repo (→ code-integration).
---

# code-service

## Analogia (.NET)

`code-api` = Controller. `code-service` = Service (wstrzykiwany/importowany, nie wołany przez sieć). `code-db` = Repository.

## Flagowy, pierwszy realny serwis: RBAC

`@cortex/service/src/rbac.ts` jest JEDYNYM źródłem uprawnień w tym repo — od 30.07.2026 również dla powłoki. Zewnętrzny `cortex-admin` został odcięty całkowicie (`app/idp/app/api/_lib/access.ts` usunięty, `CORTEX_ADMIN_API_*` skasowane z konfiguracji; nie ma fallbacku).

Dwie funkcje, dwa różne pytania:

- `requireTileAccess(request, code)` — „czy ten user ma TEN kafelek". Woła ją każdy route modułu. Fail-closed w środku (błąd bazy = `allowed:false` + log).
- `getGrantedApplicationCodes(email)` — „co ten user ma w ogóle". Woła ją wyłącznie bramka powłoki (`GET /api/me/access`), bo musi oddać klientowi pełną listę. **Propaguje wyjątek**; fail-closed egzekwuje kontroler (`app/idp/app/api/_lib/granted-apps.ts`), żeby awaria bazy była logowalna i odróżnialna od „zero grantów".

Obie chodzą po **tej samej warstwie cache** (`accessLayer`) — nowy, równoległy cache uprawnień jest błędem, nie optymalizacją: mutacja z UI woła `clearTileAccessCache()` raz i musi unieważnić jedno i drugie. Pełny kontrakt: `REFERENCE.md` w tym folderze.

## Rekordy per-user (`userEmail`) — historia, archiwa, "moje dane"

Uniwersalny wzorzec dla modułów, gdzie każdy rekord należy do konkretnego użytkownika i nikt inny (poza adminem — patrz pkt 3) nie ma go widzieć. Spisany RAZ, na wyraźną prośbę Alexa (03.08.2026, przy decyzji o historii GEO Score Calculator), żeby cztery nadchodzące moduły — GEO Score Calculator (historia analiz), Parser Dokumentów (historia zadań), Content Guru (archiwum treści), Visual Guru (archiwum obrazów) — cytowały JEDEN wzorzec zamiast wymyślać go osobno ad-hoc. Żaden z czterech modułów nie jest tu implementowany — to jest wyłącznie konwencja do zacytowania.

Przykład referencyjny (schemat, do adaptacji per moduł):

```ts
// packages/@cortex/db/src/schema/geo-score-calculator.ts
export const geoScoreCalculator = pgSchema("geo_score_calculator")

export const calculations = geoScoreCalculator.table(
  "calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Właściciel rekordu — filtr WIDOCZNOŚCI, nie ślad audytowy (patrz pkt 1).
    userEmail: text("user_email").notNull(),
    textPreview: text("text_preview").notNull(),
    totalScore: doublePrecision("total_score").notNull(),
    grade: text("grade").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Każde zapytanie tego modułu filtruje po userEmail i sortuje po createdAt —
    // dokładnie ta para kolumn, dokładnie w tej kolejności.
    byUserCreatedAt: index("calculations_user_email_created_at_idx").on(
      table.userEmail,
      table.createdAt,
    ),
  }),
)
```

### 1. Nazwa kolumny: `userEmail`/`user_email`, nie `ownerId`/FK do `users.id`

Tożsamość w tym repo to wyłącznie e-mail z `X-Auth-Request-Email` (`getRequestEmail()` wyżej) — RBAC, cache uprawnień, i najbliższy istniejący precedens per-user danych (`app/idp/app/api/_lib/ai-tools-history.ts`, dziś SQLite, kolumna `user_email`, na backlogu do migracji na Postgres — patrz `code-db/SKILL.md` "Znany dług") kluczują się po e-mailu, nie po surogackim ID. `userEmail: text("user_email").notNull()` bez `.references()` jest więc jedyną spójną odpowiedzią, nie nowym wynalazkiem:

- FK do `system_config.users.id` złamałby regułę `code-db` "brak bezpośrednich JOIN-ów między schematami modułów — dostęp cross-modułowy przez code-service, nie SQL".
- Konwersja e-mail→`users.id` byłaby dodatkowym mapowaniem donikąd — RBAC i tak operuje na e-mailu na każdym kroku.

**Nie mylić z `createdBy`.** `ilustromat.frame_templates.created_by` już istnieje w repo, ale to inny byt: ślad audytowy ("kto to stworzył") na zasobie WSPÓŁDZIELONYM (szablon marki widoczny dla wszystkich userów Ilustromatu) — nigdy filtr tego, co request w ogóle może zobaczyć. `userEmail` w tym wzorcu odwrotnie: DECYDUJE, które wiersze w ogóle wracają z zapytania. Moduł, który potrzebuje obu naraz (rekord należy do usera X, ale edytował go w jego imieniu admin Y) — to dwie osobne kolumny, nie jedna przeciążona.

### 2. Gdzie żyje bramka: w kształcie zapytania serwisowego, nie w route

`requireTileAccess()` odpowiada na pytanie binarne ("czy w ogóle kafelek") — dobrze pasujące do osobnej, współdzielonej funkcji-bramki. "Czy WIDZĘ TEN rekord" to inny rodzaj pytania: nie boolean sprawdzany PO odczycie, tylko kształt samego zapytania. Dlatego **nie ma (i celowo nie budujemy) analogicznego `requireOwnsRecord()`** jako osobnego kroku — rozważone i odrzucone: taki helper dawałby złudne poczucie bezpieczeństwa (łatwo wywołać go PO fetchu, gdy cudzy rekord już wyciekł do zmiennej) i byłby słabo typowany w praktyce (każda tabela ma kolumnę `userEmail` w innym schemacie Drizzle).

Zamiast tego: **filtr `userEmail` jest wpisany bezpośrednio w `.where()` KAŻDEGO zapytania** czytającego/modyfikującego/usuwającego rekord(y) — nigdy fetch-wszystko-i-filtruj-w-JS, nigdy fetch-po-id-a-potem-porównaj-właściciela:

```ts
// packages/@cortex/service/src/geo-score-calculator.ts
import { and, desc, eq } from "drizzle-orm"
import { calculations, getDb, type CalculationRow } from "@cortex/db"

/** Filtr jest częścią zapytania, nie osobnym krokiem możliwym do pominięcia. */
export function listMyCalculations(userEmail: string): Promise<CalculationRow[]> {
  return getDb()
    .select()
    .from(calculations)
    .where(eq(calculations.userEmail, userEmail))
    .orderBy(desc(calculations.createdAt))
}

/** Szczegóły JEDNEJ kalkulacji — właścicielstwo w WHERE, nie sprawdzane po
 *  fetchu. `undefined` zarówno dla "nie istnieje", jak i "cudze" — route mapuje
 *  oba na 404, NIGDY 403 (403 zdradzałby, że rekord o tym id w ogóle istnieje). */
export async function getMyCalculation(
  userEmail: string,
  id: string,
): Promise<CalculationRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(calculations)
    .where(and(eq(calculations.id, id), eq(calculations.userEmail, userEmail)))
  return row
}
```

Te funkcje żyją w `@cortex/service/src/<moduł>.ts`, **nie** w `app/idp/lib/<moduł>/` — wzorem `ilustromat.ts` (moduł jednokafelkowy, a mimo to cała logika dotykająca Drizzle żyje w `@cortex/service`, zgodnie z analogią .NET u góry tego pliku: code-api=Controller, code-service=Service, code-db=Repository). Zweryfikowane empirycznie w tym repo: w całym `app/idp` zero plików poza `@cortex/service`/`app/idp/app/api/**` importuje `@cortex/db` żeby odpytać bazę (jedyny pozorny wyjątek, `lib/ilustromat/render.ts`, importuje z `@cortex/db` wyłącznie TYP, nie woła `getDb()`) — `app/idp/lib/<moduł>/` jest zarezerwowane dla logiki, która nigdy nie dotyka Drizzle (prompty, rendering, adaptery integracyjne). **Uwaga dla przyszłej implementacji**: `PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md` §3 i `PROJECT/cortex-frontend-parser-dokumentow-port-projekt.md` §2 zakładały odwrotnie ("lokalne, NIE @cortex/service — logika nie jest cross-modułowa") — to założenie nie zgadza się z rzeczywistym, w 100% konsekwentnym precedensem repo; do skorygowania przy starcie Fazy 0 obu tamtych projektów.

`userEmail` przekazywany do funkcji serwisowej to **obowiązkowy, pierwszy parametr pozycyjny** (nigdy opcjonalny, nigdy odgadywany w środku funkcji) i pochodzi WYŁĄCZNIE z `access.email` zwróconego przez `requireTileAccess()` (już uwierzytelniony, znormalizowany do lowercase) — NIGDY z pola `userEmail` w body/query żądania, nawet jeśli klient je wyśle:

```ts
// app/idp/app/api/geo-score-calculator/history/route.ts
export async function GET(request: NextRequest) {
  const access = await requireTileAccess(request, "geo-score-calculator")
  if (!access.allowed || !access.email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  return NextResponse.json(await listMyCalculations(access.email)) // access.email, NIGDY z body/query
}
```

Egzekwowanie: rozszerzenie reguły 3 niżej ("Każda bramka uprawnień musi mieć test, który próbuje ją ominąć") na scoping per-user — każda `listMy*`/`getMy*` dostaje test (jednostkowy + e2e, patrz pkt 5) seedujący DWÓCH userów i dowodzący, że user A nie dostaje ani jednego rekordu usera B.

### 3. Widok admina później — bez przebudowy schematu

Żaden z czterech modułów nie potrzebuje go w v1 (wszystkie zdecydowane 03.08.2026 na "tylko własne" na start), ale kolumna `userEmail` już wystarcza, żeby dołożyć go tanio, gdy zajdzie potrzeba: druga funkcja serwisowa, identyczna poza pominiętym filtrem, gated przez warstwę granularną — dokładnie wzorzec `MANAGE_TEMPLATES_SCOPE`/`requireTileScope()` już działający w Ilustromacie (NAD `requireTileAccess()`, nie zamiast niej):

```ts
/** Jedyna funkcja modułu bez filtra userEmail. Wołający MUSI przejść
 *  requireTileScope(request, "geo-score-calculator", "view-all"), nie tylko
 *  requireTileAccess() — sam dostęp do kafelka nie uprawnia do cudzej historii. */
export function listAllCalculationsAdmin(): Promise<CalculationRow[]> {
  return getDb().select().from(calculations).orderBy(desc(calculations.createdAt))
}
```

Zero zmiany schematu — `userEmail` na każdym wierszu już jest tym, po czym widok admina filtrowałby/grupował, gdyby zechciał zawęzić do jednego usera zamiast pokazać wszystko.

### 4. Kształt zapytania listującego — jak `listApplications()`/`listHubApplications()`

`CortexDataGrid` filtruje/sortuje/paginuje po stronie przeglądarki (TanStack Table: `getFilteredRowModel`/`getSortedRowModel`/`getPaginationRowModel` nad całą tablicą `data`) — funkcja serwisowa więc NIE przyjmuje `page`/`sort`/`search`, tylko zwraca całą (już przefiltrowaną do usera i posortowaną) tablicę, dokładnie jak `listApplications()`/`listHubApplications()` (`system-config.ts`). `listMyCalculations()` z pkt 2 jest już w tym kształcie — nic więcej nie trzeba dobudowywać.

Świadome założenie skalowe: to działa dopóki liczba rekordów JEDNEGO usera zostaje w setkach, nie dziesiątkach tysięcy (historia kalkulatora/archiwum treści, nie log zdarzeń o wysokiej częstotliwości). Jeśli się to kiedyś okaże fałszywe dla konkretnego modułu — dokładać `limit`/`cursor` wtedy, nie teraz (YAGNI, zasada już stosowana konsekwentnie w tym repo).

### 5. Seedowanie e2e — dowód izolacji przez "podrzucony cudzy rekord"

`seedScenario()` (`e2e/fixtures/db-seed.ts`, patrz `code-e2e/SKILL.md`) dostaje nowy nazwany scenariusz, który seeduje rekordy WŁAŚCICIELA testu (zwracany `email`) ORAZ co najmniej jeden rekord jawnie innego, wyeksportowanego stałego adresu — wzorem już istniejącego `COWORK_STRANGER_EMAIL`/`accessMatrixEmail()`. Test nie loguje się jako drugi user (nie trzeba) — dowodzi izolacji tym, że strona zalogowanego właściciela NIGDY nie pokazuje treści z rekordu podrzuconego:

```ts
const FOREIGN_OWNER_EMAIL = "foreign-owner@e2e.local" // wzorem COWORK_STRANGER_EMAIL

case "geo-score-calculator-with-history": {
  const email = "geo-score-calculator-user@e2e.local"
  // ... insert users/roles/applications/permissionsMatrix jak w innych case'ach ...
  await db.insert(calculations).values([
    { userEmail: email, textPreview: "Tekst A", totalScore: 91, grade: "A", result: {} },
    { userEmail: email, textPreview: "Tekst D", totalScore: 54, grade: "D", result: {} },
    // Podrzucony rekord CUDZY — test dowodzi, że nigdy nie wychodzi na liście/w szczegółach.
    { userEmail: FOREIGN_OWNER_EMAIL, textPreview: "Cudzy tekst", totalScore: 10, grade: "F", result: {} },
  ])
  return { email, applications: [app!] }
}
```

```ts
// e2e/geo-score-calculator/history-isolation.spec.ts
await expect(page.getByText("Cudzy tekst")).not.toBeVisible()
```

`resetSystemConfig()` (rozszerzony o `delete(calculations)`, analogicznie do dzisiejszego `delete(frameTemplates)`) czyści to między scenariuszami — bez ręcznego sprzątania. Zero nowych parametrów `seedScenario()` — nowy przypadek to nowy nazwany literal, zgodnie z regułą już zapisaną w `code-e2e/SKILL.md`.

## Kiedy coś jest `code-service`, a kiedy nie

- **Jest**: logika reużywana MIĘDZY modułami (RBAC, przyszłe reguły biznesowe współdzielone) — żyje w `@cortex/service`, importowana.
- **Nie musi być**: logika specyficzna dla JEDNEGO modułu, nawet jeśli czysta i testowalna. Przykład: `app/idp/lib/ai-tools/prompts.ts` — czyste funkcje budujące prompty, zero JSX, w pełni testowalne, ale specyficzne wyłącznie dla AI Tools — zostają lokalnie w module, nie trzeba ich wynosić do `@cortex/service`. Nie przenoś kodu do wspólnego pakietu tylko dlatego, że jest "czysty" — przenoś, gdy faktycznie współdzielony.
- **Wyjątek od powyższego, potwierdzony precedensem**: logika DOTYKAJĄCA Drizzle/`@cortex/db` żyje w `@cortex/service` ZAWSZE, nawet gdy jest specyficzna dla jednego kafelka (`ilustromat.ts` — patrz "Rekordy per-user" niżej) — kryterium "reużywane między modułami" dotyczy tego, co wynosimy z modułu, nie tego, co dotyka bazy. `app/idp/lib/<moduł>/` jest dla logiki, która nigdy nie woła `getDb()`.

## Reguły

1. Serwis to zwykła funkcja/moduł TS, importowany — nigdy przez `fetch("/api/...")` z innego modułu tego samego appu.
2. Fail-closed jako domyślne zachowanie (brak jednoznacznej zgody = odmowa), wzorem `packages/config` z cortex2 (patrz `PROJECT/cortex-frontend-cortex2-krytyczny-audyt.md` — to jest jeden z uznanych PLUSÓW tamtego repo).
3. Każda bramka uprawnień musi mieć test, który próbuje ją ominąć na właściwej ścieżce żądania (nie tylko test jednostkowy samej funkcji) — lekcja z audytu cortex2, gdzie RBAC był sprawdzany tylko w UI, nigdy na realnej ścieżce do gatewaya.
4. Nie duplikuj reguł dostępu między klientem a serwerem — jedno źródło prawdy (dziś: `canAccessAiTool()` w `app-codes.ts`, używane identycznie po obu stronach).
