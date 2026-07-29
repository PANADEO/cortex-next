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

## Rejestr kafelków przez UX — ten sam serwis, inny use case

Wymóg Cezarego "ustawianie kafelków z UI, nie z plików" korzysta z TEGO SAMEGO schematu (`applications`/tabela rejestru) — CRUD na kafelkach to kolejny serwis w `@cortex/service` (np. `tile-registry.ts`), nie osobny mechanizm. Patrz `docs/tile-registry.md`.
