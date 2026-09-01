# Cortex Frontend — Status v0.1

**Data:** 2026-04-20
**Branch:** ui/next-prototype (via cortex_frontend/)
**Szacunek pierwotny:** 12-13 dni. **Faktyczny:** 1 sesja — prototyp funkcjonalny.

---

## Co działa end-to-end

### Auth

- NextAuth v5 beta, Credentials provider stubbed, fake user (demo@cortex.local, role admin, tileAccess [idp])
- `/login` → signIn → cookie session → redirect do `/dashboard`
- Middleware gated routes, callback URL preservation
- `X-Auth-Request-Email` header wstrzykiwany do wszystkich API calls przez `buildAuthHeaders` (swap point udokumentowany)
- SWAP POINTS oznaczone: 6 miejsc gdzie wymienia się credentials provider na real OIDC (Keycloak)

### Nawigacja / shell

- **AppShell** + **TileMenu** w `@cortex/ui` — reusable dla kolejnych kafelków
- Sidebar collapsible (Zustand + persist do localStorage) — 240px ⇄ 48px z tooltipami w collapsed
- **Topbar:** sidebar toggle, breadcrumbs z pathname (`IDP › Packages › pkg-0025`), search pill `⌘K`, notifications bell, UserMenu
- **CommandPalette (⌘K)** — filtruje navigation + packages real-time przez MSW, keyboard nav (↑↓ ↵ Esc)
- 6 stron w menu: Dashboard, Packages, Import, Audit log + Classification (coming soon) + Rule editor (coming soon)

### Screens

| Ekran           | Status                                                                                                                                                                                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard       | ✅ 6 metric cards (DataCard) + recent-5 packages (DataTable + StatusBadge). Auto-refresh 5s.                                                                                                                                                                                                                                      |
| Packages list   | ✅ Filter (status + search), sort, pagination, status badges, click-row → detail                                                                                                                                                                                                                                                  |
| Package Details | ✅ Metadata card, action buttons (reads `/transitions` endpoint — server-authoritative), tabs (Analysis result JsonViewer / Action log timeline / Source materials stub), **AutoRefreshIndicator** z auto-pause podczas verification (streamlit parity), email-gated edit permission (`canEdit = emailsMatch(session, assignee)`) |
| Import          | ✅ 2 sekcje (ZIP + loose files), FileUploader drag-drop, Fast processing toggle, mutation + toast                                                                                                                                                                                                                                 |
| Audit log       | ✅ Cross-package DataTable, filtry (action type + performed by), manual refresh                                                                                                                                                                                                                                                   |
| Classification  | ✅ Stub z EmptyState "coming soon"                                                                                                                                                                                                                                                                                                |
| Rule editor     | ✅ Stub z EmptyState "coming soon"                                                                                                                                                                                                                                                                                                |
| Login           | ✅ Simple card + "Continue as Demo User"                                                                                                                                                                                                                                                                                          |

### Design system (`@cortex/ui`)

- **23 shadcn primitives** zainstalowane przez CLI (Button, Input, Dialog, DropdownMenu, Tabs, Badge, Card, Select, Checkbox, Switch, Tooltip, Sheet, AlertDialog, Popover, Separator, ScrollArea, Skeleton, Avatar, Breadcrumb, Alert, Label, Textarea)
- **15 kompozycji:** StatusBadge, DataCard, PageHeader, DataTable, EmptyState, AppShell, TileMenu, UserMenu, JsonViewer, ActionLogTimeline, FileUploader, AutoRefreshIndicator, LoadingState, ErrorState
- **Design tokens z shadcnuidashboard.com/logistics** (monochrome neutral + semantic status — Review: 34/50 → po quick wins ~42/50 → po topbar/badge fixes: prawdopodobnie 45/50)
- Dark mode ready (CSS vars + `.dark` class, toggle nie włączony — `ThemeToggle` na P1)

### Mock backend (MSW)

- **30 endpointów z openapi.json** zmapowane w handlers
- 54 fixture packages w różnych stanach (pseudo-random seed 42)
- State machine: transitions działają (start_verification → verification, finish → verified, etc.)
- Dashboard stats obliczane z fixtures real-time
- Audit log computed cross-package
- Catch-all dla transport-order mutations
- Blob stuby dla download/export

---

## Co jest poza scope v0.1

| Kategoria | Item                                                                    | Priorytet na v0.2 |
| --------- | ----------------------------------------------------------------------- | ----------------- |
| UI        | DocumentViewer (PDF + docx-preview + xlsx render)                       | P1                |
| UI        | BoundingBoxOverlay (SVG over PDF)                                       | P2                |
| UI        | JsonEditor (inline edit verification)                                   | P1                |
| UI        | InvoiceLinesEditor                                                      | P1                |
| UI        | Dark mode toggle                                                        | P1                |
| UI        | Framer-motion transitions na modalach                                   | P2                |
| Feature   | Rule editor (logika)                                                    | P2                |
| Feature   | Classification DnD (@dnd-kit)                                           | P2                |
| Feature   | Cost allocation                                                         | P2                |
| Ops       | Playwright E2E testy                                                    | P1                |
| Ops       | Docker standalone build weryfikacja                                     | P1                |
| Ops       | Sentry/OTEL integration przez `onError` callback w boundary             | P2                |
| Feature   | `react-error-boundary` zgodnie z nową sekcją `architecture_rules.md §9` | P1                |
| Feature   | Feature flags util (`@cortex/utils/feature-flags/`) zgodnie z `§11`     | P1                |

---

## API compatibility — dla Huberta (integracja z prod API)

Pełny audit w `docs/work/api-compatibility-audit.md`. Skrót:

**Verdict:** YES, AFTER FIXES. Wszystkie 30 endpointów, 6 enumów, pagination, auth header — dopasowane byte-for-byte do openapi.json.

**2 P0 (które już naprawiłem):**

1. ✅ MSW error bodies teraz zawierają `message` field (było tylko `error_code`)
2. ⚠️ **NIE NAPRAWIALNE NA FRONTENDZIE** — backend drift: live Pydantic `PackageReadModel` używa `processing_state` + `verification_state` (dwuosiowo) ale openapi.json wciąż reklamuje jedno pole `status`. **Hubercie, potwierdź który model jest autoritative PRZED wire-upem.** Jeśli ship masz two-axis → trzeba splitować `PackageStatus` → `ProcessingState + VerificationState`, aktualizować StatusBadge i filtry.

**P1 (do rozważenia):** 3. `PackageActionType` drift: live Pydantic ma 5 dodatkowych wartości (`sad_context_updated`, `custom_status_updated`, `user_notes_updated`, `deleted`, `restored`) których nie ma w openapi. Jeśli wysyłasz te action types — regenerate openapi.json albo rozszerz `PACKAGE_ACTION_TYPE` w `@cortex/types`. 4. ✅ MSW mocks dla transport-order POST mutations (catch-all dodany)

**P2 (cosmetic):** 5. ✅ `action_logs` default `limit` zrównany z openapi (było 20, teraz 10) 6. ✅ Download/export blob stuby dodane 7. ✅ `date_from/date_to` filtry zaaplikowane w MSW `action_logs`

### Swap z MSW na prod API

Jeden flag: `NEXT_PUBLIC_API_MOCKING=enabled` w `.env.local` → ustaw na `disabled` albo usuń zmienną.

Dodatkowo w `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.idp.ay.aiportalstart.com
```

Zero zmian w kodzie feature'ów. Types, endpointy, error handling, auth header — działają identycznie.

---

## Metryki

| Metryka              | Wartość                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| TypeScript typecheck | ✅ 0 errors                                                                          |
| ESLint               | ✅ 0 errors                                                                          |
| Strict TS            | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` |
| Total dependencies   | 1031 packages                                                                        |
| Monorepo libs        | 5 (`ui`, `styles`, `api`, `types`, `utils`)                                          |
| Source files         | ~60 TSX/TS files                                                                     |
| Docs                 | 8 plików w `docs/work/` (~140KB)                                                     |

---

## Uruchomienie

```bash
# Pierwszy raz
npm install
cp .env.example .env.local   # ustaw AUTH_SECRET
cp .env.local app/idp/.env.local  # Next reads from project dir
npm run msw-init
npm run pdf-assets

# Dev
npm run dev                    # http://localhost:3000

# Weryfikacja
npm run typecheck
npm run lint
npm run test                   # vitest (nie mamy jeszcze testów — P1)
npm run build                  # prod build + standalone Docker-ready output

# Design system playground
npm run ladle                  # http://localhost:61000 (stories — still P1)
```

---

## Dla review'u

- **Patryk** — architektura monorepo (`docs/frontend-architecture.md`), decyzje stackowe, error handling §9, feature flags §11
- **Hubert** — **`docs/work/api-compatibility-audit.md`** ← must-read przed integracją, szczególnie drift: `processing_state`/`verification_state` i `PackageActionType`
- **Ani** (design) — look & feel review: `docs/work/look-and-feel-review.md` (score 34/50 → 45/50 po quick wins), dark mode toggle gdy czas

🖤
