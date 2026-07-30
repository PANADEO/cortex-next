---
name: code-service
description: Wewnętrzna warstwa serwisowa (logika biznesowa, RBAC/walidacja) w @cortex/service, importowana przez inne moduły — NIE przez HTTP. Użyj gdy trzeba sprawdzić uprawnienia, dodać regułę biznesową współdzieloną między kafelkami, albo pytasz "gdzie żyje logika X".
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

## Kiedy coś jest `code-service`, a kiedy nie

- **Jest**: logika reużywana MIĘDZY modułami (RBAC, przyszłe reguły biznesowe współdzielone) — żyje w `@cortex/service`, importowana.
- **Nie musi być**: logika specyficzna dla JEDNEGO modułu, nawet jeśli czysta i testowalna. Przykład: `app/idp/lib/ai-tools/prompts.ts` — czyste funkcje budujące prompty, zero JSX, w pełni testowalne, ale specyficzne wyłącznie dla AI Tools — zostają lokalnie w module, nie trzeba ich wynosić do `@cortex/service`. Nie przenoś kodu do wspólnego pakietu tylko dlatego, że jest "czysty" — przenoś, gdy faktycznie współdzielony.

## Reguły

1. Serwis to zwykła funkcja/moduł TS, importowany — nigdy przez `fetch("/api/...")` z innego modułu tego samego appu.
2. Fail-closed jako domyślne zachowanie (brak jednoznacznej zgody = odmowa), wzorem `packages/config` z cortex2 (patrz `PROJECT/cortex-frontend-cortex2-krytyczny-audyt.md` — to jest jeden z uznanych PLUSÓW tamtego repo).
3. Każda bramka uprawnień musi mieć test, który próbuje ją ominąć na właściwej ścieżce żądania (nie tylko test jednostkowy samej funkcji) — lekcja z audytu cortex2, gdzie RBAC był sprawdzany tylko w UI, nigdy na realnej ścieżce do gatewaya.
4. Nie duplikuj reguł dostępu między klientem a serwerem — jedno źródło prawdy (dziś: `canAccessAiTool()` w `app-codes.ts`, używane identycznie po obu stronach).
