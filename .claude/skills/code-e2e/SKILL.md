---
name: code-e2e
description: Testy E2E (Playwright) w cortex-frontend — Page Object Model, manipulacja danymi demo przez Drizzle, konwencja selektorów. Użyj przy pisaniu nowego testu E2E, nowego POM-a dla kafelka, albo pytasz "jak ustawić scenariusz danych do testu".
---

# code-e2e

## Stan dzisiejszy — dwie struktury obok siebie

`e2e/issue-66/**` to **legacy**: PO-ISSUE (nie PO-STRONA), mockuje wszystko przez `page.route`, zero bazy. Zostaje jako jest — działa, nie migruj go teraz bezmyślnie. **Nowe testy piszesz w nowej strukturze**, którą ten skill opisuje:

```
e2e/
  issue-66/            # legacy, PO-per-issue — zostaje bez zmian
  support/
    console.ts         # installConsoleErrorTracker/expectNoConsoleErrors/waitForHydrated
    mocks/
      shell-access.ts  # mockShellAccess() — przepuszcza przez AppGate (powłokę)
  fixtures/
    db-seed.ts         # resetSystemConfig() + seedScenario() — Drizzle, prawdziwy Postgres
    fixtures.ts         # test.extend(): seed, asUser(), POM-y jako fixtures
  poms/
    shared/
      base-page.ts      # BasePage — sidebar/nawigacja wspólna dla (main)
    <kafelek>/
      <strona>-page.ts  # jeden plik = jedna strona/route
  <kafelek>/
    *.spec.ts           # PO STRONIE/SCENARIUSZU, nie po issue
```

`playwright.config.ts`: `testDir: "./e2e"`, `testMatch: "**/*.spec.ts"` — obie struktury działają pod jednym `npx playwright test`.

## POM — jeden plik = jedna strona

`e2e/poms/<kafelek>/<strona>-page.ts`, klasa dziedziczy `BasePage` (`e2e/poms/shared/base-page.ts`) po wspólny sidebar/nawigację (`@cortex/ui` `AppShell`+`TileMenu` — identyczne dla każdego kafelka pod `(main)`). Lokatory jako properties/gettery w konstruktorze, akcje jako async metody. Wzorzec: `e2e/poms/system-config/users-page.ts`.

**POM per kafelek, nie per moduł-jako-całość** — `system-config` ma osobny plik per stronę (`users-page.ts`, docelowo `roles-page.ts`, `applications-page.ts`), nie jeden monolityczny `SystemConfigPage` ze wszystkim. Granica pliku = granica route'a, tak jak granica kafelka = granica `app/idp/app/(main)/<id>/`. Nazwa pliku/klasy POM-a idzie za angielskim segmentem trasy, nigdy za polskim — patrz code-ui/SKILL.md reguła 4.

## Selektory: role-based, NIE data-testid

`page.getByRole(...)`, `getByLabel(...)`, `getByText(...)` — zero `data-testid` w tym repo (sprawdzone: nie ma go nigdzie w kodzie appki, tylko w unit-testowych fixture'ach). Trzymaj się tego — to też wymusza, żeby UI był accessible. Wzorzec już używany w `e2e/issue-66/*.spec.ts`, ten sam w nowej strukturze.

## Manipulacja danymi demo — Drizzle, nie UI

`e2e/fixtures/db-seed.ts`: `seedScenario(name)` **resetuje CAŁY schemat `system_config` i seeduje jeden nazwany, deterministyczny stan** (wzorem stanów w Storybooku — nazwa, nie parametry). Dziś: `"empty"`, `"user-no-roles"`, `"admin-with-one-tile"`, `"five-tiles-one-external-link"`. Nowy scenariusz = nowy literal `ScenarioName` + `case` — nie dokładaj parametrów do istniejących.

```ts
const { email } = await seed("admin-with-one-tile")
await asUser(page, email)                              // x-auth-request-email
await mockShellAccess(page, { email, apps: ["system-config"] })
await usersPage.goto()
```

`asUser()` (w `fixtures.ts`) ustawia `x-auth-request-email` przez `context().setExtraHTTPHeaders()` — to nagłówek, który na demo-dev wstrzykuje oauth2-proxy, a lokalnie czyta `requireTileAccess()`/`getRequestEmail()`. Dzięki temu **nie restartujesz dev servera żeby zmienić "kim jesteś"** w kolejnym teście — ustawiasz nagłówek per test.

**Moduł z rekordami per-user** (historia, archiwum — patrz `code-service/SKILL.md` "Rekordy per-user"): scenariusz seeduje rekordy właściciela testu ORAZ co najmniej jeden rekord podrzucony pod jawnie innym, wyeksportowanym adresem (wzorem `COWORK_STRANGER_EMAIL`) — test dowodzi izolacji tym, że strona właściciela nigdy nie pokazuje treści z podrzuconego rekordu, bez logowania się jako drugi user.

**⚠️ DESTRUKCYJNE.** `resetSystemConfig()` czyści wszystkie tabele bezwarunkowo. Zweryfikowane na żywo: jeden przebieg testów skasował realnego bootstrap-admina z lokalnej bazy dev. Osobna baza/kontener dla e2e — nigdy ta sama instancja Postgresa co ręcznie odpalony `npm run dev`. Szczegóły: `REFERENCE.md`.

Kiedy `page.route` zamiast bazy: gdy test dotyczy WYŁĄCZNIE frontendu (np. layout, a11y, interakcja UI) i nie chcesz płacić za realne zapytanie. Gdy test ma udowodnić, że dane faktycznie płyną przez `@cortex/db`/RBAC (czyli sens testu E2E nowego modułu) — zawsze przez `db-seed.ts`, mock tylko to, co jest POZA modułem (patrz niżej).

## Dwie bramki dostępu — mockuj tylko powłokę, nie moduł

Strona pod `(main)` przechodzi przez DWIE niezależne bramki zanim cokolwiek się wyrenderuje:

1. **Powłoka** (`AppGate`) — `/user/me` + `/api/me/access`, dziś oparte o zewnętrzny cortex-admin, fail-closed bez konfiguracji lokalnie. Mockuj przez `mockShellAccess()` (`e2e/support/mocks/shell-access.ts`) — to NIE jest to, co test ma udowodnić.
2. **Moduł** (`requireTileAccess()`, `@cortex/service`) — DB-backed, prawdziwy Postgres, prawdziwe granty z `seedScenario()`. To JEST to, co test ma udowodnić dla nowych modułów jak `system-config`.

Pomyl je i albo test nic nie sprawdza (wszystko zmockowane), albo nie da się w ogóle dotrzeć do strony (moduł odmawia, zanim zdążysz cokolwiek zobaczyć). Pełne wyjaśnienie + jak to się objawia: `REFERENCE.md`.

## Twarde reguły

1. Nowy test = nowy plik `.spec.ts` pod `e2e/<kafelek>/`, PO STRONIE/SCENARIUSZU (`users-admin-scenario.spec.ts`), nie po numerze issue.
2. POM zawsze przez `e2e/poms/<kafelek>/`, dziedziczy `BasePage` — nie duplikuj nawigacji sidebara w każdym pliku.
3. Dane testowe zawsze przez `seedScenario()`, nigdy insert ad-hoc w teście — nowy przypadek to nowy scenariusz w `db-seed.ts`, czytelny z samej nazwy.
4. Asercje web-first z auto-retry (`expect(locator).toBeVisible()`), nigdy `waitForTimeout` do czekania na dane — query'sy mają `retry: 1` (`@cortex/api/src/provider.tsx`), błąd potrafi się ustawić z opóźnieniem.
5. `DATABASE_URL` dla `playwright test` (proces Node, NIE `webServer`) musi wskazywać na bazę dedykowaną e2e — patrz ostrzeżenie wyżej.
6. Selektory role-based, zero `data-testid`.

## Dodanie POM-a dla nowego kafelka

1. `e2e/poms/<kafelek>/<strona>-page.ts`, klasa dziedziczy `BasePage`.
2. Jeśli kafelek ma własny schemat w `@cortex/db` — dopisz `case` w `seedScenario()` (albo, gdy scenariusze zaczną się mnożyć per moduł, osobny plik `e2e/fixtures/db-seed/<kafelek>.ts` re-eksportowany z `db-seed.ts` — nie teraz, YAGNI dopóki jest jeden moduł z bazą).
3. Test pod `e2e/<kafelek>/*.spec.ts`, import z `../fixtures/fixtures` (NIE `@playwright/test` bezpośrednio, jeśli potrzebujesz `seed`/POM-ów).

Przykład referencyjny (POM + test, `system-config`): `e2e/poms/system-config/users-page.ts`, `e2e/system-config/users-admin-scenario.spec.ts`.
