# code-e2e — REFERENCE

Wszystko niżej zweryfikowane na żywo 29.07.2026 (lokalny `next dev`, realny Postgres w `cortex-next-postgres`), nie wyczytane z dokumentacji.

## AppGate a `requireTileAccess()` — dwie różne bramki, dwa różne mechanizmy

`app/idp/components/shell/app-gate.tsx` (owija każdą stronę pod `(main)`, patrz `app/idp/app/(main)/layout.tsx`) sprawdza DWIE rzeczy zanim wyrenderuje `children`:

1. `useMe()` → `GET /user/me` → `{ email, has_access, scopes? }` (`@cortex/types` `UserInfoResponse`).
2. `useAuthorizedApps()` → `GET /api/me/access` → `{ allowed, apps, email }`. **Od 30.07.2026 to jest WŁASNY endpoint czytający WŁASNEGO Postgresa** (`getGrantedApplicationCodes()` z `@cortex/service`, ten sam cache co `requireTileAccess()`). Zewnętrzny `cortex-admin` został odcięty — `CORTEX_ADMIN_API_*` nie istnieją, nie ma fallbacku. Endpoint nadal zwraca 200 przy odmowie (nie błąd!), więc `AppGate` renderuje `AccessDeniedScreen` cicho, bez wyjątku.

Sygnał (1) pochodzi z zewnętrznego backendu IDP i po zwężeniu `hasAccessIsRelevant` bramkuje **wyłącznie kafelek `idp`**. Na pozostałych kafelkach i na hubie jego brak/awaria nic nie blokuje. Hub ma osobną bramkę `HubGate` (sam `allowed`), bo nie jest kafelkiem i nie ma własnego kodu w rejestrze.

Osobno, **wewnątrz** modułu, każdy route pod `app/idp/app/api/<moduł>/**` woła `requireTileAccess()` z `@cortex/service` — również DB-backed, czyta `system_config.*` przez Drizzle (`rbac-store.ts`). Po unifikacji obie bramki mają TO SAMO źródło i ten sam cache; różnią się pytaniem („cała lista" vs „ten jeden kod"), nie mechanizmem.

**Konsekwencja dla testów**: żeby dotrzeć do treści strony kafelka, musisz przepuścić przez obie warstwy:
- Powłokę → albo `mockShellAccess(page, { email, apps: [...] })` (tanio), albo — od teraz — po prostu **zseedować granty w bazie** i wysłać nagłówek przez `asUser()`. Mockowanie powłoki stało się OPCJONALNE.
- Moduł → `seedScenario(...)` + `asUser(page, email)` — TU chcesz prawdziwych danych.

> [!warning] `mockShellAccess()` zaślepia dokładnie ten endpoint, który po tej zmianie warto testować
> Cały pakiet E2E korzystający z `mockShellAccess()` zostanie ZIELONY nawet przy kompletnie zepsutym `/api/me/access`. Dlatego istnieje `e2e/shell/access-gate.spec.ts`, który **celowo go nie woła** i idzie realną ścieżką: seed w Postgresie → prawdziwy route → `AppGate` → treść kafelka (macierz: każdy kod rejestru wchodzi na swoją trasę i dostaje odmowę na cudzej, plus zimny start pustej bazy). Pisząc nowy test SAMEJ bramki, dopisuj go tam, nie do suit modułowych.

Pomieszanie warstw to najczęstszy błąd: zmockowanie WSZYSTKIEGO (w tym `/api/system-config/*`) daje test, który niczego nie dowodzi o module; brak mocka powłoki BEZ seeda grantów daje `AccessDeniedScreen` zanim dotrzesz do właściwego kodu.

## Identyczna tożsamość, dwa niezależne mechanizmy fallbacku

Serwer czyta tożsamość z `x-auth-request-email` (nagłówek wstrzykiwany przez oauth2-proxy na demo-dev/produkcji, ZAWSZE wygrywa gdy obecny), z fallbackiem na `DEV_USER_EMAIL` (env, nie `NEXT_PUBLIC_`) WYŁĄCZNIE gdy nagłówek jest nieobecny — bramkowane samą obecnością zmiennej, celowo NIE `NODE_ENV`, bo webpack zamraża `NODE_ENV` w standalone buildzie na stałe (03.08.2026: to właśnie czyniło fallback martwym kodem w każdym obrazie Dockera) — JEDNA implementacja: `packages/@cortex/service/src/rbac.ts` (`getRequestEmail`, normalizuje adres do lowercase). `app/idp/lib/cortex-governance/request-identity.ts` (`requestEmail`) jest dziś cienkim adapterem na nią, a trzecia kopia (`app/idp/app/api/_lib/access.ts`) zniknęła razem z tym plikiem. `NEXT_PUBLIC_DEV_USER_EMAIL` (client, używany przez MSW handler `/user/me`) to INNA zmienna — nie myl ich. `playwright.config.ts` `webServer.env` ustawia dziś tylko `NEXT_PUBLIC_DEV_USER_EMAIL`, nie `DEV_USER_EMAIL` — dlatego `asUser()`/nagłówek per-request jest właściwym mechanizmem do wyboru tożsamości w testach, nie poleganie na `DEV_USER_EMAIL` (który wymagałby restartu serwera per scenariusz).

## Pułapka: `reuseExistingServer` + MSW cicho zmienia zachowanie testu

`playwright.config.ts` ma `reuseExistingServer: !process.env.CI` — lokalnie, jeśli COKOLWIEK już nasłuchuje na porcie 3000 (np. ręcznie odpalony `npm run dev` w innym terminalu), Playwright **reużywa ten proces zamiast spawnować własny z env z configu** (`NEXT_PUBLIC_API_MOCKING: disabled`). Jeśli ten ręcznie odpalony serwer ma MSW WŁĄCZONE (domyślne `.env.example`: `NEXT_PUBLIC_API_MOCKING=enabled`), jego Service Worker przechwytuje żądania w przeglądarce PRZED tym, jak dotrą do warstwy `page.route` — więc `page.route("**/user/me", ...)` cicho **nie działa**, a odpowiedź daje handler z `app/idp/mocks/handlers.ts` zamiast Twojego mocka.

Zweryfikowane: `curl http://localhost:3000/api/me/access` (bez przeglądarki, więc bez MSW) dał `{"allowed":false,"apps":[]}`; ten sam request z poziomu strony w Playwright (MSW aktywne w reużytym serwerze) dał `{"allowed":true,"apps":[...,"system-config"]}`. Test przechodził — ale nie z powodu, o którym myślał autor.

**Wniosek**: przed uruchomieniem nowych testów sprawdź `lsof -i :3000` — jeśli coś tam już siedzi, testy mogą przechodzić z zupełnie innego powodu niż w CI (świeży spawn, MSW faktycznie disabled, `page.route` faktycznie jedynym interceptorem). W razie wątpliwości ubij proces i pozwól Playwrightowi wystartować własny.

## Bezpieczeństwo bazy dla e2e

`resetSystemConfig()` w `db-seed.ts` czyści WSZYSTKIE tabele `system_config` bezwarunkowo, bez filtra po sufiksie/prefiksie (inaczej niż `rbac.integration.test.ts`, który sprząta tylko swoje wiersze po `SUFFIX`). Powód: e2e ma testować UI na czystym, przewidywalnym stanie, nie współistnieć z resztkami. Cena: **jeśli `DATABASE_URL` wskazuje na Twoją zwykłą lokalną bazę dev, `seedScenario()` skasuje realnego bootstrap-admina i wszystko, co dodałeś ręcznie przez UI.** Potwierdzone doświadczalnie podczas pisania tego skilla — trzeba było odtworzyć admina przez `db:seed` i ręcznie dosypać skasowany wiersz.

Rekomendacja: osobna baza/kontener dla e2e (np. drugi Postgres na innym porcie, albo osobny `POSTGRES_DB=cortex_e2e` w tym samym kontenerze) — nie zaimplementowane dziś, YAGNI dopóki jeden dev pisze testy lokalnie, ale **pierwsza rzecz do zrobienia, gdy e2e z seedem trafi do CI** (inaczej każdy run resetuje bazę, na której coś innego mogło polegać).

## Katalog scenariuszy (`db-seed.ts`)

| Scenariusz | Stan bazy | Do czego |
|---|---|---|
| `"empty"` | zero wierszy | ekrany "brak dostępu"/puste bez żadnego usera w tle |
| `"user-no-roles"` | user istnieje, zero ról | `requireTileAccess()` odmawia mimo istniejącego usera — 403 wewnątrz modułu, powłoka i tak wpuszcza (jeśli zmockowana) |
| `"admin-with-one-tile"` | user + rola `admin` + grant do `system-config` | happy path — pełny łańcuch user→rola→grant→aplikacja |
| `"five-tiles-one-external-link"` | jw. + 5 wierszy w `applications` (4× native, 1× external-link) | rejestr kafelków — renderowanie różnych `kind` |

Nowy scenariusz zawsze jako nazwany literal, nigdy jako parametryzowana funkcja (`seedScenario("admin", {roles: [...]})`) — cel to czytelność w teście (`seed("admin-with-one-tile")` mówi wszystko), nie elastyczność.

## Timing: `retry: 1` na queries

`@cortex/api/src/provider.tsx` ustawia domyślnie `retry: 1` dla wszystkich `useQuery`. Błąd (np. 403 z `requireTileAccess()`) NIE ustawia się w stan `isError` od razu — jest jedna próba ponowienia z opóźnieniem (TanStack default backoff, ~1s). `page.waitForLoadState("networkidle")` potrafi rozstrzygnąć się W TRAKCIE tej przerwy (brak aktywnych połączeń przez >500ms), więc kolejny `waitForTimeout(500)` może nie wystarczyć i złapiesz jeszcze stan `isLoading`. Zawsze asercja auto-retry na finalnym stanie (`expect(locator).toBeVisible()`), nigdy ręczne `waitForTimeout` + odczyt DOM.

## Co przenieść z `e2e/issue-66/helpers.ts`, co zostawić

Wartościowe, kafelek-agnostyczne (już zduplikowane do `e2e/support/console.ts`, nie zaimportowane z issue-66 celowo — patrz komentarz w pliku): `installConsoleErrorTracker`, `expectNoConsoleErrors`, `waitForHydrated`.

Specyficzne dla modułu IDP, NIE przenosić 1:1: `mockBackendApi()` (fejkuje konkretne endpointy `/packages/*` starego backendu IDP), `buildFakePackage`/`buildFakeActions` (fixture danych IDP). Nowy kafelek dostaje własny plik mocków pod `e2e/support/mocks/<kafelek>.ts` jeśli w ogóle potrzebuje mockować zewnętrzny backend — `system-config` tego nie potrzebuje, bo cała jego logika idzie przez `@cortex/db` w tym samym repo.

`mockAuth()` z issue-66 mockuje `/user/me` w kształcie `{id, email, name, has_access}` — NIE zgadza się z prawdziwym `UserInfoResponse` (`{email, has_access, scopes?}`, `@cortex/types`). Działa dziś bo konsumenci czytają tylko `email`/`has_access`, ale `mockShellAccess()` w nowej strukturze celowo używa prawdziwego typu — nie kopiuj kształtu ze starego helpera bez sprawdzenia.
