---
name: code-service
description: Wewnętrzna warstwa serwisowa (logika biznesowa, RBAC/walidacja) w @cortex/service, importowana przez inne moduły — NIE przez HTTP. Użyj gdy trzeba sprawdzić uprawnienia, dodać regułę biznesową współdzieloną między kafelkami, albo pytasz "gdzie żyje logika X".
---

# code-service

## Analogia (.NET)

`code-api` = Controller. `code-service` = Service (wstrzykiwany/importowany, nie wołany przez sieć). `code-db` = Repository.

## Flagowy, pierwszy realny serwis: RBAC

`requireTileAccess()` w `@cortex/service/src/rbac.ts` — **dziś celowo rzuca błąd, nie jest podłączone**. Prawdziwa, działająca logika autoryzacji dziś żyje w `app/idp/app/api/_lib/access.ts` (`getAccessResult`, pyta zewnętrzny `cortex-admin`) — używaj TEGO wzorca do czasu migracji (Ścieżka E, port cortex-admin → `konfiguracja_systemu` w `@cortex/db`). Pełny kontrakt: `REFERENCE.md` w tym folderze.

## Kiedy coś jest `code-service`, a kiedy nie

- **Jest**: logika reużywana MIĘDZY modułami (RBAC, przyszłe reguły biznesowe współdzielone) — żyje w `@cortex/service`, importowana.
- **Nie musi być**: logika specyficzna dla JEDNEGO modułu, nawet jeśli czysta i testowalna. Przykład: `app/idp/lib/ai-tools/prompts.ts` — czyste funkcje budujące prompty, zero JSX, w pełni testowalne, ale specyficzne wyłącznie dla AI Tools — zostają lokalnie w module, nie trzeba ich wynosić do `@cortex/service`. Nie przenoś kodu do wspólnego pakietu tylko dlatego, że jest "czysty" — przenoś, gdy faktycznie współdzielony.

## Reguły

1. Serwis to zwykła funkcja/moduł TS, importowany — nigdy przez `fetch("/api/...")` z innego modułu tego samego appu.
2. Fail-closed jako domyślne zachowanie (brak jednoznacznej zgody = odmowa), wzorem `packages/config` z cortex2 (patrz `PROJECT/cortex-frontend-cortex2-krytyczny-audyt.md` — to jest jeden z uznanych PLUSÓW tamtego repo).
3. Każda bramka uprawnień musi mieć test, który próbuje ją ominąć na właściwej ścieżce żądania (nie tylko test jednostkowy samej funkcji) — lekcja z audytu cortex2, gdzie RBAC był sprawdzany tylko w UI, nigdy na realnej ścieżce do gatewaya.
4. Nie duplikuj reguł dostępu między klientem a serwerem — jedno źródło prawdy (dziś: `canAccessAiTool()` w `app-codes.ts`, używane identycznie po obu stronach).
