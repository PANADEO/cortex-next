---
name: code-tile
description: Tworzenie/modyfikacja kafelka (modułu) Cortex360 w cortex-frontend — gdzie ląduje kod, jaki ma kształt, kiedy rozszerzyć istniejący AI Tools hub a kiedy zeskaffoldować nowy. Użyj przy "dodaj kafelek", "nowy moduł", "jak zbudować narzędzie AI", oraz przy wszystkim wokół `manifest.ts`/`defineTile()` ("kafelek się nie rejestruje", "gdzie dopisać manifest"). Licencja i aktywacja modułu → code-license, wygląd kafelka → code-theme.
---

# code-tile

## Gdzie fizycznie ląduje kod

`app/idp` to dziś **root projektu Next.js** (`package.json`: `next build app/idp`), nie folder specyficzny dla modułu IDP — historyczna nazwa, patrz `docs/modular-monolith.md` sekcja "app-root". Wszystkie nowe kafelki wchodzą pod `app/idp/app/(main)/<id>/`. Nie zakładaj nowego top-level folderu poza tym — Next.js go nie zobaczy.

## Dwie ścieżki — wybierz PRZED pisaniem kodu

**A) Kafelek kształtu "text-tool"** (textarea wejściowa → opcje → prompt LLM → wynik) — **rozszerz istniejący AI Tools hub**, nie twórz nowego folderu:
1. Dodaj `AiToolId` w `app/idp/lib/ai-tools/app-codes.ts`.
2. Dodaj wpis w `AI_TOOL_DEFINITIONS` (`app/idp/lib/ai-tools/registry.ts`).
3. Dodaj `buildXPrompt()` w `app/idp/lib/ai-tools/prompts.ts` (czysta funkcja, zero JSX — to jest wzorzec `code-service`).
4. Dodaj `XForm` w `app/idp/components/ai-tools/ai-tool-workspace.tsx` + wpis w dispatcherze.
5. Dodaj manifest `app/idp/lib/ai-tools/manifests/<id>.manifest.ts` (te narzędzia nie mają własnego folderu, więc manifesty stoją tam zbiorczo) + import w barrelu — patrz sekcja "Manifest" niżej.

To jest **tańsze i bezpieczniejsze** niż nowy folder — reużywasz przetestowany routing/auth/historię. Nie przebudowuj tej struktury na "folder per narzędzie" bez wyraźnego powodu (patrz `PROJECT/cortex-frontend-ai-tools-hub-audyt.md` w Obsidianie — realna duplikacja między narzędziami jest niska).

**B) Kafelek innego kształtu** (własny model danych, własne API poza prostym prompt+wynik, np. Konfiguracja Systemu) — nowy folder:
```bash
pnpm gen tile
```
Generuje `app/idp/app/(main)/<id>/{page.tsx,manifest.ts}` + `app/idp/app/api/<id>/generate/route.ts` ze szkieletem.

## Manifest — jedyny rejestr kafelka z kodem

`defineTile()` z `@cortex/tile-sdk` w pliku `manifest.ts` obok strony. **Nie ma drugiego miejsca, w którym kafelek się zgłasza.** `app/idp/lib/tiles.ts` nie jest już rejestrem — hub renderuje z bazy (`GET /api/hub/tiles`); plik żyje jako źródło nawigacji, palety poleceń i stałych kategorii.

Droga manifestu do bazy:

```
<id>/manifest.ts  →  barrel app/idp/lib/tile-manifests.ts
                  →  scripts/generate-tile-manifests.mjs (esbuild, etap `builder` w Dockerfile)
                  →  packages/@cortex/db/scripts/tile-manifests.generated.json
                  →  seed-tile-manifests.mjs  →  wiersz w system_config.applications
```

**Import zapomniany w barrelu = kafelek nie zarejestruje się w ŻADNEJ instancji.** `tsc` nie widzi pliku, którego nikt nie importuje, więc pilnuje tego osobny test: `app/idp/lib/tile-manifests-completeness.test.ts`.

Co niesie manifest, a czego nie:

- **Tożsamość i trasowanie** (`id`, `kind`, `entitlementCode`, `route`/`url`) — fakty o kodzie. Wygrywają przy każdym deployu.
- **Wartości POCZĄTKOWE prezentacji** (`label`, `description`, `icon`, `color`, `categoryFunctional`, `categoryDepartment`, `sortOrder`) — wpisywane **wyłącznie przy pierwszym INSERCIE**. W runtime właścicielem jest admin i jego edycje muszą przeżyć deploy (→ `code-seed`).
- **`entitlementOnly: true`** — gdy kod jest uprawnieniem, nie kafelkiem (→ `code-license`).
- Manifest **nie** aktywuje kafelka. Wiersz powstaje jako nieaktywny kandydat; włącza go admin albo `BOOTSTRAP_MODULES`.

Dokładając pole do manifestu, dokładasz je **najpierw** do `TileManifestSchema` w `packages/@cortex/tile-sdk/src/index.ts`. Schemat jest w trybie `strip` (zwykły `z.object`, nie `.strict()`), więc nieznany klucz nie daje błędu Zoda — ale zasięg tej pułapki jest węższy, niż brzmi, i to zmierzono: w normalnym zapisie (`defineTile({ ... })` na literale obiektu) nadmiarowy klucz **łapie typecheck** jako TS2353, także gdy literał zawiera spread. Zod ucina po cichu wyłącznie tam, gdzie kontrola literału nie ma czego sprawdzać — przy rzutowaniu i gdy obiekt powstaje najpierw w zmiennej. Tę cichą połowę pilnuje `packages/@cortex/tile-sdk/src/index.test.ts`.

**Kafelki `external-link` NIE mają manifestu** i to jest reguła, nie zaniedbanie: nie mają kodu w tym repo, więc zakłada je admin z panelu i są daną instancji. Parzystości pilnuje `tile-registry-parity.test.ts`.

## Twarde reguły

1. Zero importów spoza `@cortex/*` poza własnym folderem kafelka.
2. Wywołania LLM wyłącznie przez `code-api` → `code-integration` — nigdy bezpośredni `fetch` do cortex-proxy z UI/page.
3. Sprawdzenie dostępu wyłącznie przez `requireTileAccess()` z `@cortex/service` — patrz `code-service`.
4. Kafelek typu `external-link`/`iframe` (np. OpenWebUI) to WYŁĄCZNIE wiersz założony z panelu — zero kodu aplikacyjnego i zero manifestu.
5. Kafelek natywny bez manifestu w barrelu jest nieosiągalny dla wszystkich i to jest zachowanie zamierzone (fail-closed), nie usterka.
6. Wygląd kafelka na hubie (ikona, kolor, akcent) → `code-theme`. Pod presetem Domino kolumna `applications.color` nie jest czytana.

## Znane kolizje nazw (do sprawdzenia przed nazwaniem nowego kafelka)

`presentation-generator` = generator prezentacji (dawniej błędnie `visual-guru` — id skorygowany 03.08.2026, `PROJECT/cortex-next-todo.md` "visual-guru: dokończyć rename"). `visual-guru` jest odtąd WOLNY, zarezerwowany dla nadchodzącego prawdziwego generatora obrazów (`PROJECT/cortex-frontend-visual-guru-tile-projekt.md`) — nie używaj tego id do niczego innego. `cortex-config` = governance Cortex Cowork (nie ogólna konfiguracja systemu), `ai-daily-assistant` — usuwany na rzecz OpenWebUI. Pełna lista: `PROJECT/cortex-frontend-tiles-inwentaryzacja.md`.
