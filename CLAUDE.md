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
/app/<tile>/*            → aplikacje (kafelki) — np. /app/idp
/libs/@cortex/ui/*       → shared komponenty
/libs/@cortex/styles/*   → tokens, Tailwind config, themes
/libs/@cortex/api/*      → shared API layer
/libs/@cortex/types/*    → shared TypeScript types
/libs/@cortex/utils/*    → shared utilities
/docs/*                  → dokumentacja architektoniczna
```

Reużywalne → `/libs/@cortex/*`. App-specific → `/app/<tile>/*`.
Brak workspace managera na tym etapie (pnpm/turbo dorzucamy gdy zacznie boleć).

## Shell architecture

- Cortex360 to **shell**, IDP to pierwszy moduł — kolejne dochodzą jako `/app/<tile>/*`.
- Routing: landing pod `/`, każdy moduł pod własnym prefixem `/<tile>/*` (np. `/idp/dashboard`, `/idp/packages`).
- Route groups w `app/idp/app/`:
  - `(shell)` — landing (header + tile-grid + footer, brak sidebara)
  - `(main)` — moduły z app-shell (sidebar `TileMenu` + `Topbar`)
  - `(auth)` — login
  - `idp/<route>` poza `(main)` — fullscreen workspace pages (np. `verify/[id]`, `classification/[id]`)
- **Tiles są hardcoded w kodzie**, nie przez API. Rejestr: `app/idp/lib/tiles.ts` (typowany `Tile[]`).
  Decyzja: tiles zmieniają się rzadko, code-driven jest szybsze niż backend + admin panel.
- Login redirect: `/login` → `/` (landing).
- `auth.ts` ma pole `tileAccess: string[]` na sesji — placeholder na przyszłą filtrację per-user.

## Brand & theming

- **Kolor brand**: `cortex` (#4A90E2) — w `tailwind.config.ts` jako `cortex.{DEFAULT,dark,light}`.
- **Logo**: `app/idp/public/cortex-logo.png` (drzewo obwodów navy, 9 KB).
  Dark mode: `<Image className="dark:invert dark:hue-rotate-180" />` → navy w light → light cyan-blue w dark, jeden asset.
  Logo to drzewo obwodów, koniec — nie wymyślać alternatyw (literki, kwadraty, gradient).
- **Favicon**: `app/idp/app/favicon.ico` (Next.js convention — auto picked up, nie pisać `<link>`).
- Theme/skin store: `useThemeStore` (light/dark/system), `useSkinStore` (default/customs).
  Toggle w `(shell)` shell-header i `(main)` topbar — JEDEN store, dwa miejsca renderu.
- Paleta CSS-vars: `libs/@cortex/styles/globals.css` (źródło prawdy, NIE duplikować w inline style).

## Backend integration — known gap

`apiClient` (`libs/@cortex/api/`) wywołuje endpointy bez prefixu — middleware proxuje wybrane wzorce do
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
3. Auth — login redirect, `PUBLIC_PATHS`, `callbackUrl`.

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
- **MUST read:** [docs/frontend-architecture.md](docs/frontend-architecture.md) — decyzje stackowe i uzasadnienia
