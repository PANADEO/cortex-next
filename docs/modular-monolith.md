# Modularny monolit — reguły od 29.07.2026

Status: obowiązujące. Pełne uzasadnienie/historia decyzji: Obsidian `PROJECT/cortex-frontend-tiles-architektura.md`.

## Twarda reguła: jeden app, jeden build, jeden deploy — na stałe

**Bez Multi-Zones.** Nie mieszamy — albo cały system jest jednym deployowanym Next.js appem, albo żadna jego część nie jest osobną "zoną". Multi-Zones dawałoby build-time izolację per moduł, ale kosztem twardej nawigacji (pełny reload) między KAŻDĄ parą kafelków w różnych zonach i N osobnych pipeline'ów deployu — realnie odtwarza operacyjny koszt starego `cortex-box-prototype`, tylko przeniesiony do monorepo.

Build-time wykluczanie kodu (docelowy wymóg licencyjny — klient nie dostaje kodu, za który nie zapłacił) realizujemy INACZEJ: pre-build pruning folderów tras per-klient, nie Multi-Zones. Nieaktywne dziś — Faza 2.

## `app-root` — nazewnicza zaszłość, nie architektura

Root projektu Next.js to fizycznie `app/idp` (`package.json`: `next build app/idp`) — nazwa historyczna z czasów gdy IDP było jedynym modułem. **Wszystkie nowe kafelki wchodzą pod `app/idp/app/(main)/<id>/`, nie pod nowy top-level folder.** To nie błąd — Next.js po prostu nie zobaczy niczego poza swoim rootem.

Zmiana fizycznej nazwy folderu jest rozważana jako sprzątanie Fazy 2+, NIE teraz — ryzyko w Dockerze: `docker-compose.image.yml` ma zaszyte ścieżki wolumenów (`/app/app/idp/.data/cortex-cowork` itd.), a to dokładnie ten obszar, w którym już raz był incydent produkcyjny (wadliwa heurystyka ścieżek w `data-dir.ts` rozjechała dane governance Cowork na dwa katalogi). Import w kodzie idzie przez alias `@/*`, więc sam rename byłby tani — ryzyko jest w warstwie Docker/wolumenów, nie w TypeScript.

## Warstwy (analogia .NET) — patrz `.claude/skills/code-*`

`code-tile` (moduł/routing) → `code-api` (controller/BFF route) → `code-service` (logika biznesowa/RBAC, import nie HTTP) → `code-db` (Drizzle, schema-per-moduł). Plus: `code-ui` (współdzielone komponenty), `code-integration` (wołanie serwisów zewnętrznych: cortex-proxy, chat), `code-compose` (Docker).

## Granica modułu

Kafelek importuje WYŁĄCZNIE `@cortex/*` — zero sięgania w wewnętrzności innego kafelka. Dziś egzekwowane przez konwencję (skille); `eslint-plugin-boundaries` w CI to krok Fazy 2, jeszcze niewpięty.

**Powłoka nigdy nie zależy od backendu pojedynczego modułu**: tożsamość bierze z WŁASNYCH tras — `/api/me/identity` w menu użytkownika (`useShellUser()` w `@cortex/api`) i `/api/me/access` na ekranie odmowy w `AppGate` (ta trasa i tak rozstrzyga tam o dostępie, więc bramka nie dokłada trzeciego żądania; obie zwracają ten sam e-mail z nagłówka oauth2-proxy).

Reguła mówi o ZALEŻNOŚCI, nie o wywołaniu. `/user/me` — i analogiczne endpointy backendów modułów — powłoce wolno wołać na każdej trasie (i tak robi: `useShellUser()` w `@cortex/api`, obie bramki w `app-gate.tsx`, hub w `home-page-client.tsx`), ale wyłącznie po **opcjonalne wzbogacenie** (`scopes` → badge „IDP admin") albo jako **rozstrzygnięty fallback** (niżej). Sprawdzian: gdy ta odpowiedź nigdy nie przyjdzie, powłoka ma wyrenderować się normalnie, tylko uboższa. Czekanie na nią albo bramkowanie nią powłoki to złamanie reguły — jedynym wyjątkiem jest `has_access` dla kafelka `idp` w `AppGate`, bo tam bramkujemy ekran samego modułu.

Jedyny dopuszczalny udział `/user/me` w tożsamości powłoki to **fallback po rozstrzygnięciu** własnego źródła: gdy własna trasa zwróciła błąd albo pustkę, wolno pokazać e-mail z modułu zamiast "—" (nieregresyjność na demo-dev). Nigdy PRZED rozstrzygnięciem — fallback w stanie `pending` to wyścig, w którym powłoka miga cudzą tożsamością, zanim podmieni ją na własną.

## Referencyjna implementacja

`app/idp/lib/ai-tools/*` + `app/idp/components/ai-tools/ai-tool-workspace.tsx` + `app/idp/app/api/ai-tools/generate/route.ts` — pierwszy realny, przetestowany przykład tego wzorca (choć jeszcze przed pełnym rozbiciem na `code-integration`, patrz `code-api/SKILL.md` "znany dług").
