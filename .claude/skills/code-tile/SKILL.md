---
name: code-tile
description: Tworzenie/modyfikacja kafelka (modułu) Cortex360 w cortex-frontend — gdzie ląduje kod, jaki ma kształt, kiedy rozszerzyć istniejący AI Tools hub a kiedy zeskaffoldować nowy. Użyj przy "dodaj kafelek", "nowy moduł", "jak zbudować narzędzie AI".
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
5. `aiToolTile()` w `app/idp/lib/tiles.ts` doda go do siatki automatycznie.

To jest **tańsze i bezpieczniejsze** niż nowy folder — reużywasz przetestowany routing/auth/historię. Nie przebudowuj tej struktury na "folder per narzędzie" bez wyraźnego powodu (patrz `PROJECT/cortex-frontend-ai-tools-hub-audyt.md` w Obsidianie — realna duplikacja między narzędziami jest niska).

**B) Kafelek innego kształtu** (własny model danych, własne API poza prostym prompt+wynik, np. Konfiguracja Systemu) — nowy folder:
```bash
pnpm gen tile
```
Generuje `app/idp/app/(main)/<id>/{page.tsx,manifest.ts}` + `app/idp/app/api/<id>/generate/route.ts` ze szkieletem. Manifest przez `defineTile()` z `@cortex/tile-sdk` — jedyny dozwolony sposób deklaracji kafelka (`kind: "native" | "external-link" | "iframe"`).

## Twarde reguły

1. Zero importów spoza `@cortex/*` poza własnym folderem kafelka.
2. Wywołania LLM wyłącznie przez `code-api` → `code-integration` — nigdy bezpośredni `fetch` do cortex-proxy z UI/page.
3. Sprawdzenie dostępu wyłącznie przez `requireTileAccess()` z `@cortex/service` — patrz `code-service`.
4. Kafelek typu `external-link`/`iframe` (np. OpenWebUI) to WYŁĄCZNIE wpis w rejestrze — zero kodu aplikacyjnego.
5. Po dodaniu kafelka dopisz go do rejestru (dziś: `app/idp/lib/tiles.ts` lub `AI_TOOL_DEFINITIONS`; docelowo: UI "Rejestr kafelków" w Konfiguracji Systemu — patrz `docs/tile-registry.md`).

## Znane kolizje nazw (do sprawdzenia przed nazwaniem nowego kafelka)

`presentation-generator` = generator prezentacji (dawniej błędnie `visual-guru` — id skorygowany 03.08.2026, `PROJECT/cortex-next-todo.md` "visual-guru: dokończyć rename"). `visual-guru` jest odtąd WOLNY, zarezerwowany dla nadchodzącego prawdziwego generatora obrazów (`PROJECT/cortex-frontend-visual-guru-tile-projekt.md`) — nie używaj tego id do niczego innego. `cortex-config` = governance Cortex Cowork (nie ogólna konfiguracja systemu), `ai-daily-assistant` — usuwany na rzecz OpenWebUI. Pełna lista: `PROJECT/cortex-frontend-tiles-inwentaryzacja.md`.
