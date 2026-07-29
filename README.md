# Cortex Frontend

Prototyp nowego frontendu platformy **Cortex360**. Pierwszy zbudowany moduł: **IDP** (Invoice/Document Processing) — migrowany ze Streamlita na Next.js. Stanowi fundament architektoniczny i design-system dla kolejnych modułów Cortex360.

## Architektura modułów (od 29.07.2026)

Modularny monolit — jeden app, jeden build, bez Multi-Zones. Zacznij od [docs/modular-monolith.md](docs/modular-monolith.md), potem [docs/tile-registry.md](docs/tile-registry.md), [docs/database.md](docs/database.md), [docs/infrastructure.md](docs/infrastructure.md). Konwencje kodu jako skille: `.claude/skills/code-*`.

## Status

Prototyp funkcjonalny. Aplikacja działa end-to-end na mockowanym backendzie (MSW) — bez integracji z produkcyjnym API. Scope prototypu obejmuje:

- parity ze Streamlitową aplikacją IDP (dashboard, lista paczek, import, audit log, package details)
- workspace weryfikacji z inline spreadsheet + side-by-side PDF
- scaffold MVP klasyfikacji dokumentów (dirty → clean packages)
- scaffold MVP edytora reguł (NL → kompilacja → preview → wersjonowanie)
- auth deferred do oauth2-proxy (Caddy `forward_auth`); frontend identyfikuje usera przez `useMe()` → `/user/me`

Integracja z realnym backendem, pełne coverage testów, accessibility audit — poza scope'em prototypu.

## Cortex 2.0 — po demie (hardening)

Warstwa platformowa Cortex 2.0 (moduły `cortex-cowork` + `cortex-config`, governance core, runner na Flue w `cowork-runner/`) jest **demem G1** i prototypem — nie jest jeszcze production-safe. Audyt architektury (Codex `gpt-5.6-sol`, read-only) wykazał 1 Critical + 8 High; pełna lista z `file:line`: [docs/architecture-audit.md](docs/architecture-audit.md).

**Do zrobienia po demie (blokery przed użyciem klienckim/produkcyjnym):**

- **Autoryzacja end-to-end** — API coworka nie egzekwują dostępu do projektu ani ownershipu sesji (rola filtruje tylko widoczność kafelków). Dodać `requireProjectAccess` / `requireSessionAccess` na każdym endpoincie, `ownerEmail` na sesji, fail-closed bootstrap zamiast pustej `adminEmails` = każdy.
- **Realna izolacja wykonania i sekretów** — produkcja Docker-only (odrzucać `local` mode), minimalny allowlisted env dla runnera i CLI-konektorów (dziś dziedziczą cały `process.env`), fail-closed przy nierozwiązanym credential-refie.
- **Transakcyjny, idempotentny store tur/sesji** — JSON-file nie jest concurrency-safe; retry + SSE-fallback mogą dublować side-effecty. Idempotency-key na turę + rewizja governance sprawdzana co turę (rewokacja grantu nie unieważnia dziś istniejących sesji).

Nie ruszać (audyt potwierdził jako słuszne): rozdziału rola-bramka / projekt-toolkit, granicy kopiowanych skilli (dodać tylko wersjonowanie + rewokację), seamu model-provider + standalone runner.

## Stack

- **Framework:** Next.js 15 + React 18 + TypeScript 5.8 (wszystko `"use client"`, bez RSC)
- **UI:** shadcn/ui (Radix + Tailwind 3.4) + CSS variables dla tematów
- **Tabele:** TanStack Table v8 + `@tanstack/react-virtual`
- **Stan:** TanStack Query (server) + Zustand (client)
- **Formularze:** React Hook Form + Zod
- **Dokumenty:** `react-pdf` + `pdfjs-dist`, `docx-preview`, `xlsx`
- **Interakcja:** `@dnd-kit`, `sonner`, `framer-motion`, `lucide-react`, `date-fns`
- **Dev/QA:** Ladle (component dev), Vitest + Testing Library + jsdom, MSW (mock API)
- **Auth:** oauth2-proxy (przy edge'u, poza appem) + `useMe()` over `/user/me`
- **Deployment:** self-hosted Docker (Next.js standalone)

Szczegółowe decyzje i uzasadnienia — [docs/frontend-architecture.md](docs/frontend-architecture.md).

## Struktura repo

```
/app/<moduł>/*           aplikacje (moduły) — np. /app/idp
/libs/@cortex/ui/*       shared komponenty (shadcn + kompozycje)
/libs/@cortex/styles/*   design tokens, Tailwind config, tematy
/libs/@cortex/api/*      shared API layer (apiClient, error handling)
/libs/@cortex/types/*    shared TypeScript types
/libs/@cortex/utils/*    shared utilities (formatters, validators)
/docs/*                  dokumentacja architektoniczna
/scripts/*               build helpers (copy-pdf-assets, generate-mock-pdf)
```

Reużywalne idą do `/libs/@cortex/*`. Moduł-specific zostaje w `/app/<moduł>/*`.

Brak workspace managera (pnpm/turbo) na tym etapie — dorzucimy gdy duplikacja buildów lub nieczyste zależności zaczną boleć.

## Uruchomienie

### Pierwsze uruchomienie

```bash
npm install
cp .env.example app/idp/.env.local
npm run msw-init                     # inicjalizuje MSW service worker
npm run assets                       # kopiuje PDF.js workery + generuje mock PDF
```

Minimalne `app/idp/.env.local`:

```bash
NEXT_PUBLIC_API_MOCKING=enabled
```

### Dev

```bash
npm run dev           # http://localhost:3000
```

### Weryfikacja

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run test          # vitest
npm run build         # production build (Docker-ready standalone output)
```

### Component dev

```bash
npm run ladle         # http://localhost:61000
```

## Skrypty npm

| Skrypt | Opis |
|---|---|
| `dev` | Next.js dev server z hot reload (port 3000) |
| `build` | Production build z `output: "standalone"` (Docker-ready) |
| `start` | Uruchomienie production buildu |
| `typecheck` | TypeScript strict check bez emisji |
| `lint` | ESLint na `app/` i `libs/` |
| `format` | Prettier na całym repo |
| `test` / `test:watch` | Vitest (unit + integration) |
| `ladle` / `ladle:build` | Component dev serwer / statyczny build |
| `msw-init` | Kopiuje MSW service worker do `app/idp/public/` |
| `pdf-assets` | Kopiuje PDF.js workery |
| `mock-assets` | Generuje mock PDF dla classification |
| `assets` | `pdf-assets` + `mock-assets` |

## Swap z MSW na prod API

Jedna zmienna w `app/idp/.env.local`:

```bash
NEXT_PUBLIC_API_MOCKING=disabled
NEXT_PUBLIC_API_BASE_URL=https://<prod-api-host>
```

Zero zmian w kodzie feature'ów — types, endpointy, error handling, auth header działają identycznie.

## Dokumentacja

| Plik | Zawartość |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Instrukcje dla agentów AI — kontekst projektu, technology stack, repository layout |
| [architecture_rules.md](architecture_rules.md) | Reguły kodowe — naming, konwencje, feature modules, testing, deployment |
| [docs/frontend-architecture.md](docs/frontend-architecture.md) | Decyzje stackowe z uzasadnieniem (framework, UI, state, error handling, feature flags) |
| [docs/archived/](docs/archived/) | Historyczne dokumenty planowania (Wave 0/1 — implementation plan, design tokens, UX map ze Streamlita, API contract, look & feel review, lego blocks). Referencyjne — większość spraw opisanych tam jest już zrealizowana w kodzie. |

## Wymagane przed pracą z kodem

1. **Przeczytaj:** `CLAUDE.md` + `architecture_rules.md` + `docs/frontend-architecture.md`
2. **Stosuj się do:** reguły z `architecture_rules.md` (naming, feature modules, error handling, testing)
3. **Minimal diff:** zachowuj kontrakty i granice między modułami, unikaj przedwczesnej abstrakcji
4. **NIE twórz `.md`** bez jawnej prośby
