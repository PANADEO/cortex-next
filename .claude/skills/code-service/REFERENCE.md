# code-service — REFERENCE

## Kontrakt `requireTileAccess()` (docelowy, po migracji na Postgres)

```ts
interface TileAccessResult {
  allowed: boolean
  email: string | null
}

function requireTileAccess(request: Request, entitlementCode: string): Promise<TileAccessResult>
```

Wejście: `Request` (czyta `X-Auth-Request-Email`, fallback `DEV_USER_EMAIL` poza produkcją — wzorem `getRequestEmail()` w `access.ts`). Wyjście: `allowed` fail-closed (brak headera/brak granta = `false`, nie `true`).

## Dzisiejszy, działający wzorzec (do skopiowania, nie do zastąpienia bez migracji)

`app/idp/app/api/_lib/access.ts`:
- `getRequestEmail(headers)` — header w produkcji, `DEV_USER_EMAIL` w dev.
- `getAuthorizedAppsAtCortexAdmin(email)` — HTTP do zewnętrznego `cortex-admin` (`CORTEX_ADMIN_API_BASE_URL`+`CORTEX_ADMIN_API_KEY`), zwraca listę kodów aplikacji.
- Cache 30s per email (`CACHE_TTL_MS`), max 10k wpisów, prosty LRU-ish eviction.
- `AUTHORIZED_APP_CODES` — allowlista tego, co frontend w ogóle przepuści z odpowiedzi cortex-admin.

## Plan migracji (Ścieżka E)

1. Schemat `system_config` w `@cortex/db` (users/roles/user_roles/permissions_matrix/application_scopes/role_application_scopes — kształt wzorem audytu cortex-admin, `PROJECT/cortex-frontend-cortex-admin-audyt-funkcji.md`, sekcja "Rdzeń — PORTOWAĆ").
2. `requireTileAccess()` w `@cortex/service` czyta z tego schematu zamiast HTTP do cortex-admin — usuwa cross-service round-trip.
3. Cache pattern (30s TTL) zostaje — teraz cache'uje wynik zapytania do własnej bazy zamiast do zewnętrznego serwisu.
4. `getAccessResult`/`getAuthorizedAppsAtCortexAdmin` w `access.ts` — do usunięcia PO migracji, nie wcześniej (cortex-admin zostaje źródłem prawdy do czasu ukończenia Ścieżki E).

## Cache uprawnień — zakres i świadome ograniczenia

`requireTileAccess()` cache'uje kody grantów per e-mail (30 s TTL, max 10k wpisów, LRU-ish eviction).

- **Unieważnienie jest natychmiastowe**: każda mutacja uprawnień w `system-config.ts` (`setUserRoles`, `setApplicationRoles`, `setRoleApplications`, `updateApplication`, `deleteApplication`) woła `clearTileAccessCache()`. Bez tego odebranie dostępu działałoby dopiero po TTL — dowód regresji: `system-config.integration.test.ts`.
- **Single-flight**: równoległe żądania tego samego użytkownika przy zimnym cache dzielą jedno zapytanie do bazy. Licznik `generation` pilnuje, żeby odczyt rozpoczęty PRZED unieważnieniem nie zapisał nieaktualnego wyniku po nim.
- **ZAAKCEPTOWANE OGRANICZENIE — cache jest per-proces.** Przy wielu instancjach appu `clearTileAccessCache()` czyści tylko własny proces; pozostałe dogaszają wpisy po TTL (do 30 s). Świadomie nie budujemy inwalidacji cross-instance (wymagałaby pub/sub albo współdzielonego cache) — 30 s okna na POZOSTAŁYCH instancjach jest akceptowalne dla modułu administracyjnego.

## Ochrona przed samo-zablokowaniem

`updateApplication`/`deleteApplication`/`setApplicationRoles` odrzucają (`SelfLockoutError` → HTTP 409) zmiany, które odcięłyby dostęp do modułu administracyjnego: zmianę `code`, dezaktywację i usunięcie wiersza `SYSTEM_CONFIG_APP_CODE` oraz pozostawienie go bez ani jednej uprawnionej roli. Blokada MUSI żyć w serwisie — blokada pola w formularzu nie zatrzymuje żądania wysłanego curlem.

## Rejestr kafelków przez UX — ten sam serwis, inny use case

Wymóg Cezarego "ustawianie kafelków z UI, nie z plików" korzysta z TEGO SAMEGO schematu (`applications`/tabela rejestru) — CRUD na kafelkach to kolejny serwis w `@cortex/service` (np. `tile-registry.ts`), nie osobny mechanizm. Patrz `docs/tile-registry.md`.
