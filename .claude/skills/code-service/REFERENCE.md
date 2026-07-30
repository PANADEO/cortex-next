# code-service — REFERENCE

## Kontrakt `requireTileAccess()`

```ts
interface TileAccessResult {
  allowed: boolean
  email: string | null
}

function requireTileAccess(request: Request, entitlementCode: string): Promise<TileAccessResult>
```

Wejście: `Request` (czyta `X-Auth-Request-Email`, fallback `DEV_USER_EMAIL` poza produkcją — `getRequestEmail()` w `rbac.ts`, normalizuje adres do lowercase). Wyjście: `allowed` fail-closed (brak headera/brak granta/błąd bazy = `false`, nie `true`).

## Kontrakt `getGrantedApplicationCodes()`

```ts
function getGrantedApplicationCodes(email: string): Promise<string[]>
```

Pełna lista kodów aplikacji przyznanych temu adresowi. Jedyny konsument: `GET /api/me/access` (bramka powłoki), która musi oddać listę do przeglądarki. Adres normalizowany do lowercase w środku, więc wołający nie musi o tym pamiętać.

**Różnica względem `requireTileAccess()`, celowa:** ta funkcja NIE połyka błędu bazy, tylko go propaguje. Fail-closed robi kontroler (`app/idp/app/api/_lib/granted-apps.ts` → pusta lista). Dzięki temu awaria bazy jest logowalna i odróżnialna od „użytkownik nie ma grantów" — czym w wersji z cortex-adminem nie była (`catch { return [] }` zjadał wszystko).

## Jeden cache dla obu ścieżek

Obie funkcje idą przez prywatny `getGrantedCodes()` → `cached(accessLayer, …)`: 30 s TTL, max 10k wpisów, LRU-ish eviction, dedup odczytów-w-locie (single-flight) i licznik `generation` chroniący przed wyścigiem z `clearTileAccessCache()`.

**Nie dobudowuj drugiego cache'a dla powłoki.** Mutacja uprawnień z UI woła `clearTileAccessCache()` jeden raz — równoległy cache oznaczałby, że odebranie dostępu działa natychmiast w API modułu, a w hubie dopiero po wygaśnięciu cudzego TTL. Dowód, że dzielą wpis: `rbac.test.ts`, opis „wspólny cache z requireTileAccess".

## Źródło uprawnień: własny Postgres, bez fallbacku (od 30.07.2026)

`app/idp/app/api/_lib/access.ts` (HTTP do `cortex-admin`, drugi cache, allowlista `AUTHORIZED_APP_CODES`) **został usunięty w całości**, razem z `CORTEX_ADMIN_API_BASE_URL`/`CORTEX_ADMIN_API_KEY` i martwym `CORTEX_APP_CODE`.

Konsekwencje, o których trzeba wiedzieć pisząc kod:

- **Rejestr w bazie JEST allowlistą.** Nie ma już drugiej listy kodów w kodzie. Nowy kafelek = wiersz w `system_config.applications` (seed `packages/@cortex/db/scripts/seed-system-config.mjs`), nie wpis w tablicy TS. To strukturalnie usuwa klasę błędu „dwie ręcznie utrzymywane listy się rozjechały" (dotąd gubiła `sp-console`, `sp-client`, `okna-czasowe`, `meeting-guru`).
- **Migracje + seed są krokiem deployu** (usługa `migrate` w `docker-compose.yml` / `docker-compose.image.yml`). Aplikacja wstająca na pustej bazie odcina wszystkich, łącznie z panelem, którym dałoby się to naprawić.
- **Awaria Postgresa gasi teraz także powłokę**, nie tylko API modułów. Świadomy koszt: netto liczba serwisów, których awaria gasi instancję, spadła z dwóch (cortex-admin + backend IDP) do jednego.

## Cache uprawnień — zakres i świadome ograniczenia

`requireTileAccess()` cache'uje kody grantów per e-mail (30 s TTL, max 10k wpisów, LRU-ish eviction).

- **Unieważnienie jest natychmiastowe**: każda mutacja uprawnień w `system-config.ts` (`setUserRoles`, `setApplicationRoles`, `setRoleApplications`, `updateApplication`, `deleteApplication`) woła `clearTileAccessCache()`. Bez tego odebranie dostępu działałoby dopiero po TTL — dowód regresji: `system-config.integration.test.ts`.
- **Single-flight**: równoległe żądania tego samego użytkownika przy zimnym cache dzielą jedno zapytanie do bazy. Licznik `generation` pilnuje, żeby odczyt rozpoczęty PRZED unieważnieniem nie zapisał nieaktualnego wyniku po nim.
- **ZAAKCEPTOWANE OGRANICZENIE — cache jest per-proces.** Przy wielu instancjach appu `clearTileAccessCache()` czyści tylko własny proces; pozostałe dogaszają wpisy po TTL (do 30 s). Świadomie nie budujemy inwalidacji cross-instance (wymagałaby pub/sub albo współdzielonego cache) — 30 s okna na POZOSTAŁYCH instancjach jest akceptowalne dla modułu administracyjnego.

## Ochrona przed samo-zablokowaniem

`updateApplication`/`deleteApplication`/`setApplicationRoles` odrzucają (`SelfLockoutError` → HTTP 409) zmiany, które odcięłyby dostęp do modułu administracyjnego: zmianę `code`, dezaktywację i usunięcie wiersza `SYSTEM_CONFIG_APP_CODE` oraz pozostawienie go bez ani jednej uprawnionej roli. Blokada MUSI żyć w serwisie — blokada pola w formularzu nie zatrzymuje żądania wysłanego curlem.

## Rejestr kafelków przez UX — ten sam serwis, inny use case

Wymóg Cezarego "ustawianie kafelków z UI, nie z plików" korzysta z TEGO SAMEGO schematu (`applications`/tabela rejestru) — CRUD na kafelkach to kolejny serwis w `@cortex/service` (np. `tile-registry.ts`), nie osobny mechanizm. Patrz `docs/tile-registry.md`.
