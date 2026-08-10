# Cortex Frontend

> **Do not modify this file unless explicitly requested by user.**

## Kontekst

**Prototyp** nowego frontendu platformy **Cortex360** — monorepo modułów ("kafelków"). Pierwszy moduł: **IDP** (Invoice/Document Processing), migrowany ze Streamlita na Next.js. Ten moduł stanowi pierwszą zbudowaną część nowego frontendu — fundament architektoniczny i design-system dla kolejnych modułów Cortex360.

## General principles

- KISS, DRY
- Before implementation, think step by step whether there exists a less elaborate, simpler, more elegant and more reliable solution to the problem
- Focus on delivering the minimal necessary functionality
- Apply minimal diff, maintain contracts and boundaries
- Strict TypeScript typing always
- Reuse utilities; avoid new dependencies unless already present in repo
- NEVER auto-create `.md` files; explicit request only
- Code should be self-documenting, no redundant comments

## Technology stack

- **Framework:** Next.js 15 + React 18 + TypeScript 5.8 (all `"use client"`, no RSC)
- **UI:** shadcn/ui (Radix + Tailwind 3.4) + CSS variables for theming
- **Tables:** TanStack Table v8 + `@tanstack/react-virtual`
- **State:** TanStack Query (server) + Zustand (client)
- **Forms:** React Hook Form + Zod
- **Docs:** `react-pdf` + `pdfjs-dist`, `docx-preview`, `xlsx` (SheetJS)
- **Interaction:** `@dnd-kit`, `sonner`, `framer-motion`, `lucide-react`, `date-fns`
- **Dev/QA:** Ladle (component dev), Vitest + Testing Library + jsdom, MSW (API mocking)
- **Deployment:** self-hosted Docker (Next.js standalone), NextAuth

## Repository layout

```
/app/<tile>/*                → aplikacje (kafelki) — np. /app/idp
/packages/@cortex/ui/*       → shared komponenty
/packages/@cortex/styles/*   → tokens, Tailwind config, themes
/packages/@cortex/api/*      → shared API layer
/packages/@cortex/db/*       → schema Drizzle, migracje, seedy deployu
/packages/@cortex/service/*  → logika domenowa (RBAC, system-config, sync)
/packages/@cortex/tile-sdk/* → `defineTile()` i schemat manifestu kafelka
/packages/@cortex/types/*    → shared TypeScript types
/packages/@cortex/utils/*    → shared utilities
/docs/*                      → dokumentacja architektoniczna
```

Reużywalne → `/packages/@cortex/*`. App-specific → `/app/<tile>/*`.
pnpm workspace (`pnpm-workspace.yaml`) — katalog `/libs/` już nie istnieje.

## Shell architecture

- Cortex360 to **shell**, IDP to pierwszy moduł — kolejne dochodzą jako `/app/<tile>/*`.
- Routing: landing pod `/`, każdy moduł pod własnym prefixem `/<tile>/*` (np. `/idp/dashboard`, `/idp/packages`).
- Route groups w `app/idp/app/`:
  - `(shell)` — landing (header + tile-grid + footer, brak sidebara)
  - `(main)` — moduły z app-shell (sidebar `TileMenu` + `Topbar`)
  - `idp/<route>` poza `(main)` — fullscreen workspace pages (np. `verify/[id]`, `classification/[id]`)
- **Kafelek z kodem rejestruje MANIFEST**, nie ręczna lista. `defineTile()` (`@cortex/tile-sdk`) obok strony
  kafelka, zebrany w barrelu `app/idp/lib/tile-manifests.ts` → JSON w etapie `builder` → `seed-tile-manifests.mjs`
  wstawia wiersz do `system_config.applications`. Manifest jest **dowodem, że kod istnieje w tym repo**:
  niesie tożsamość, trasowanie i wartości POCZĄTKOWE pól prezentacyjnych, wpisywane wyłącznie przy pierwszym
  INSERCIE — w runtime właścicielem jest admin i jego edycje przeżywają deploy.
  Zapomniany import w barrelu = kafelek nie zarejestruje się w żadnej instancji; pilnuje tego
  `tile-manifests-completeness.test.ts`, bo `tsc` nie widzi pliku, którego nikt nie importuje.
- **Kafelki `external-link` NIE mają manifestu** i to jest reguła, nie zaniedbanie: nie mają kodu w tym repo,
  więc zakłada je admin z panelu i są daną instancji. Rejestru pilnuje `tile-registry-parity.test.ts`.
- **Świeża baza aktywuje wyłącznie rdzeń** (`system-config`; plus `ilustromat` i `token-usage`, które aktywują
  się we własnych seedach — historyczny wzorzec do uporządkowania). Resztę włącza admin albo `BOOTSTRAP_MODULES`,
  przechodzące przez tę samą bramkę licencyjną co `ENABLED_MODULES` — **przecięcie, nigdy suma**.
- `app/idp/lib/tiles.ts` **nie jest już rejestrem** — hub renderuje z bazy (`GET /api/hub/tiles`). Plik żyje jako
  źródło nawigacji, palety poleceń i stałych kategorii; jego konsolidacja to osobne zadanie.
- **Wyjątek — kafelki `task-chat` (Cortex Cowork)** NIE są w `tiles.ts`. Konfiguruje je centralnie
  kafelek **Cortex Config** (`archetype: agent-config`), a hub dociąga je per user z governance store
  (`GET /api/cortex-cowork/projects`, filtr ról server-side). Governance (role, grupy skilli,
  przypisania, connectory, credential store, sandbox mode, export) żyje w `app/idp/lib/cortex-governance/`
  (JSON w `app/idp/.data/cortex-cowork/`). Runtime agentowy: Flue w `cowork-runner/`. Roadmapa: `docs/ROADMAP.md`.

## Auth

- **Single source of truth = oauth2-proxy** (Caddy `forward_auth` na demo-dev). Frontend NIE ma własnej sesji ani NextAuth.
- Proxy wstrzykuje `X-Auth-Request-Email` na każdym requeście. Backend (`/user/me`) czyta header i zwraca tożsamość.
- Frontend dowiaduje się "kto jestem" przez `useMe()` hook (`@cortex/api`) → `GET /user/me`. Cookie `_oauth2_proxy_*` leci przez `credentials: "include"` w `apiClient`.
- Logout: `window.location.assign("/logout")` → Caddy snippet redirectuje na `/oauth2/sign_out?rd=<post-logout>`. Brak ręcznego budowania chainu w kodzie.
- Lokalny dev: `NEXT_PUBLIC_DEV_USER_EMAIL` w env nadpisuje email w MSW handlerze `/user/me`.

## Brand & theming

- **Kolor brand**: `cortex` (#4A90E2) — w `tailwind.config.ts` jako `cortex.{DEFAULT,dark,light}`.
- **Logo**: `app/idp/public/cortex-logo.png` (drzewo obwodów navy, 9 KB).
  Dark mode: `<Image className="dark:invert dark:hue-rotate-180" />` → navy w light → light cyan-blue w dark, jeden asset.
  Logo to drzewo obwodów, koniec — nie wymyślać alternatyw (literki, kwadraty, gradient).
- **Favicon**: `app/idp/app/favicon.ico` (Next.js convention — auto picked up, nie pisać `<link>`).
- **Wygląd to PRESET, nie sam skin**: nazwana wiązka `{ skin, hubLayout, variants }` w
  `app/idp/lib/presets/registry.ts` (`neutral` | `customs` | `domino`). Store: `usePresetStore`
  (zastąpił `useSkinStore`), `useThemeStore` osobno dla light/dark/system. Przełącznik w `(shell)`
  shell-header i `(main)` topbar.
- **Trzy warstwy i nie mieszać ich** (`PROJECT/cortex-frontend/ARTIFACTS/cortex-frontend-presety-wygladu-projekt.md`):
  1. tokeny — kolor, promień, grubość krawędzi, font, tracking; **skin to WYŁĄCZNIE wartości, ani jednej reguły układu**,
  2. warianty CVA — ten sam DOM ułożony inaczej (`tabs`, `tile`),
  3. layout — DOM realnie się różni; rejestr `HUB_LAYOUTS`, wejście bramkowane testem kontraktowym.
  Nowy wygląd zaczyna na warstwie 1; awans wyżej wymaga wykazania, że niżej się nie da.
- **Ani jedna reguła CSS nie jest zakresowana `[data-preset]`** — o layoucie i wariantach decyduje preset
  w Reakcie, więc warunek w CSS-ie powtarzałby decyzję już podjętą i kosztował mignięcie nieostylowanego układu.
- Preset instancji (`system_config.instance_settings`, ekran `/system-config/appearance`) czyta **layout korzenia
  po stronie serwera** i emituje w pierwszych bajtach dokumentu — stąd `force-dynamic` i zero tras prerenderowanych.
  Odczyt jest ograniczony czasowo, bo niedostępna baza stoi na ścieżce renderu każdej strony.
- Paleta CSS-vars: `packages/@cortex/styles/globals.css` (źródło prawdy, NIE duplikować w inline style).
  Klasa skinu nakładana runtime'owo **musi być w `safelist`** w `tailwind.config.ts` — forma napisowa, nie wzorzec
  (wzorce rozwijają się wobec nazw narzędzi, więc `.skin-*` zostaje wycięte, i to tylko w jasnym motywie).

## Backend integration — known gap

`apiClient` (`packages/@cortex/api/`) wywołuje endpointy bez prefixu — middleware proxuje wybrane wzorce do
backendu IDP (`IDP_BACKEND_URL`, default `http://idp-app`).

**MSW handlery (`app/idp/mocks/handlers.ts`) traktujemy jako żywą specyfikację kontraktu** dla
endpointów które jeszcze nie istnieją w backendzie (`C:/Git/cortex/idp/` — FastAPI). Lista
"ahead of backend" (stan kwiecień 2026): `/classification/*`, `/rules/*`. Lokalnie działają via MSW;
na demo-dev → 404.

Przed dodaniem nowego endpointu po stronie frontendu — sprawdź:
1. Czy backend ma router (`grep "@router.get" w idp/idp_app/src/api/`)?
2. Czy middleware (`app/idp/middleware.ts`) ma ścieżkę w `STATIC_IDP_PATHS` / `JSON_API_PATTERNS` / `DOWNLOAD_PATTERNS`?
3. Czy MSW handler matchuje shape backendu?

Pełen pattern integracji: [`docs/backend-integration.md`](docs/backend-integration.md).

## Middleware — kolejność operacji

`app/idp/middleware.ts` wykonuje (po kolei):
1. `tryIdpRewrite` — proxy ścieżek backendowych do `IDP_BACKEND_URL` (matchowane przez patterns).
2. `tryLegacyRedirect` — 308 z legacy URL (`/dashboard`, `/packages` itd.) na `/idp/*`.
   **Skip dla `Accept: application/json`** — XHR z apiClient nie powinno dostać 308 → HTML page.

Page-level auth jest poza middleware — oauth2-proxy + Caddy zatrzymują nieautoryzowany ruch przed dotarciem do Next.js.

Dodanie nowego pattern proxy / legacy redirect:
- proxy backend → `tryIdpRewrite`
- nowa ścieżka page'a → `app/idp/app/(main)/<tile>/<route>` lub `(shell)/...`
- przeniesienie URL → dopisz do `LEGACY_REDIRECTS`

## Release flow

1. Commit + annotated tag `v0.1.X` na `main` (semver: bump patch dla bugfix/polish, minor dla nowej feature/modułu).
2. GitHub Actions buduje image `ghcr.io/panadeo/cortex-frontend:v0.1.X`.
3. Semaphore (`devops.aiportalstart.com`) odpala Ansible playbook → pull image → deploy na demo-dev (`cortex-frontend.demo-dev.aiportalstart.com`).
4. Weryfikacja przez Playwright na demo-dev po deploy. Live URL pod oauth2-proxy + Keycloak.

Konwencja commit message: `(feat|fix|chore|docs) v0.1.X — krótki opis`.

## Required Reading

- **MUST follow:** [architecture_rules.md](architecture_rules.md) — naming/code/testing conventions
- **MUST follow:** [docs/modular-monolith.md](docs/modular-monolith.md) — reguły modularnego monolitu (jeden app, bez Multi-Zones), warstwy `code-*`, patrz też `.claude/skills/code-*`
- **MUST read:** [docs/frontend-architecture.md](docs/frontend-architecture.md) — decyzje stackowe i uzasadnienia (obsolete w części o strukturze, patrz banner w pliku)
