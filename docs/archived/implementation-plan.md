# Implementation Plan — Cortex Frontend v0.1 (IDP prototype)

**Status:** Ready to execute
**Data:** 2026-04-20
**Scope:** IDP prototype jako pierwszy kafelek Cortex. Mocked data przez MSW, API shape 1:1 z openapi.
**Szacunek:** 12-13 dni solo, Lego-first.

---

## 0. Referencje (wszystkie w `docs/work/`)

| Plik                  | Zawartość                                                              |
| --------------------- | ---------------------------------------------------------------------- |
| `streamlit-ux-map.md` | 5 ekranów, flowy, session state, edge cases — źródło prawdy dla UX     |
| `api-contract.md`     | 28 endpointów, 4 enumy, state machine, 8 red flagów                    |
| `ts-types-draft.ts`   | TypeScript types dla wszystkich read models — paste do `@cortex/types` |
| `design-tokens.md`    | Tokens z shadcnuidashboard/logistics + tailwind.config + globals.css   |
| `auth-setup.md`       | NextAuth v5 blueprint, 6 swap pointów, fake user                       |
| `repo-setup.md`       | Wszystkie configi paste-ready (package.json, next.config, tsconfig, …) |
| `lego-blocks.md`      | 65 komponentów, priorytety, prop sketche, build order                  |

---

## 1. Stack delta (vs. wcześniejszy plan)

**Dodane:** `react-resizable-panels` (używany przez shadcn `Resizable`) — dla `PackageSideBySide` (document viewer ⇄ json editor split). Dodaj do `package.json` w Wave 0.

**Potwierdzone lock:**

- Next.js 15 + React 18, wszystko `"use client"`, bez RSC/Server Actions
- shadcn/ui (new-york style, zinc base) + Tailwind 3.4 + CSS vars
- TanStack Query + Zustand + RHF + Zod
- NextAuth v5 beta (`5.0.0-beta.29`)
- MSW 2 + Ladle + Vitest + Testing Library
- Self-hosted Docker, `output: "standalone"`, `outputFileTracingRoot = repoRoot`

---

## 2. Waves — execution order

### Wave 0 — Foundations (1 day)

**Cel:** `npm run dev` odpala pustą apkę z aktywnymi tokenami.

1. `git init`, skopiuj configi z `repo-setup.md` §2–§12
2. Dodaj `react-resizable-panels` do `dependencies`
3. `npm install`
4. Scaffold `/libs/@cortex/{ui,styles,api,types,utils}/src/index.ts`
5. `/libs/@cortex/styles/` → paste `globals.css` + `tokens.css` z `design-tokens.md`
6. `npm run msw-init` → generuje `app/idp/public/mockServiceWorker.js`
7. `npm run pdf-assets` → kopiuje pdfjs worker
8. Minimalny `app/idp/app/layout.tsx` + `page.tsx` ("hello cortex")
9. Verify: `npm run dev`, `npm run typecheck`, `npm run lint`

**Done:** blank page, dark mode toggle przez devtools działa, typecheck zielony.

---

### Wave 1 — Shared foundation packages (1 day)

**Cel:** typowany API client + auth scaffolding.

1. **`@cortex/types`** — paste `ts-types-draft.ts`, rozbij po domenach: `packages.ts`, `audit.ts`, `enums.ts`, `errors.ts`, `user.ts`. Re-export z `index.ts`.

2. **`@cortex/utils`**:
   - `cn()` helper (clsx + tailwind-merge)
   - `formatMoney(value: string)` — money-as-string preserving (red flag z R2: API zwraca money jako string)
   - `formatWeight(value: string)` — analogicznie
   - `formatDate(value, format)` — date-fns wrapper z tz-awareness

3. **`@cortex/api`**:
   - `apiClient` — fetch wrapper, baseURL z env, auth header injection z NextAuth session
   - `ErrorCode` enum → `errorCodeToMessage(code)` mapper → sonner toast helper
   - `buildAuthHeaders(session)` z swap pointem do real proxy (z `auth-setup.md` §8)
   - Per-endpoint query hook factories (`usePackagesQuery`, `usePackageQuery`, …) — TanStack Query opakowanie

4. **NextAuth v5 scaffold** — paste z `auth-setup.md`:
   - `app/idp/auth.ts` (credentials provider → fake user)
   - `app/idp/middleware.ts` (protected routes)
   - `app/idp/app/api/auth/[...nextauth]/route.ts`
   - `app/idp/types/next-auth.d.ts` (role + tileAccess augmentation)
   - `SessionProvider` wrapper w root layout
   - `app/idp/app/(auth)/login/page.tsx` — "Continue as Demo User"

5. **Root providers tree** (`app/idp/app/layout.tsx`): `MswProvider` → `SessionProvider` → `QueryClientProvider` → children.

**Done:** `useSession()` zwraca fake usera, `apiClient.get('/packages')` przechodzi do MSW (pusta odpowiedź OK).

---

### Wave 2 — Tier 1 primitives (2 days)

**Cel:** 23 P0 primitives w Ladle z wariantami.

1. Batch install: `npx shadcn@latest add button input textarea label select checkbox switch dialog alert-dialog sheet dropdown-menu popover tooltip tabs badge card separator scroll-area skeleton avatar breadcrumb alert` → ląduje w `libs/@cortex/ui/src/components/ui/`
2. `Toaster` wrap nad sonner (własny komponent, re-export `toast()` z `@cortex/ui`)
3. `@cortex/ui/src/index.ts` — barrel exports
4. **Ladle stories** per komponent: `Default`, per-variant, `Disabled` (gdy applicable). Plik `<name>.stories.tsx` obok komponentu.
5. Smoke test: `npm run ladle` — wszystkie 23 renderują się w light + dark

**Done:** Ladle grid complete, `npm run typecheck` clean.

---

### Wave 3 — Tier 2 compositions (2 days)

**Cel:** 14 P0 compositions z realistic fixtures w Ladle.

Kolejność (przód = mniej zależności):

**Day 5:**

- `EmptyState`, `LoadingState`, `ErrorState`, `PageHeader`, `DataCard`, `StatusBadge` (typed na `ProcessingState | VerificationState` z `@cortex/types`), `FormField` (RHF wrapper), `UserMenu` (reads NextAuth session)

**Day 6:**

- `DataTable` (TanStack Table + `@tanstack/react-virtual` gdy rows > 200; selection, sort, sticky header, server-pag mode)
- `JsonViewer` (recursive, collapsible, copy-node)
- `ActionLogTimeline` (virtualized gdy > 100)
- `AutoRefreshIndicator` (timer + pause/resume — kluczowy dla verification pause, `lego-blocks.md` §AutoRefreshIndicator)
- `FileUploader` (native onDrop, multi-file, optional client-side zipping — `streamlit-ux-map.md` §2.1 flow)
- `DocumentViewer` shell + PDF viewer (lazy `dynamic(..., { ssr: false })`)

**Ladle stories** per komponent: `Default`, `Loading`, `Error`, `Empty` + 1 business scenario. Fixtures w `libs/@cortex/ui/src/fixtures/`.

**Done:** 14 compositions zielone w Ladle z dark mode, API props zgodne z `lego-blocks.md`.

---

### Wave 4 — Tier 3 layouts (1 day)

**Cel:** pełny app shell z routingiem, ale puste ekrany.

1. **`AppShell`** — sidebar collapsible (Zustand + `persist` localStorage), topbar, main content `flex-1 min-h-0`. Responsive `md` → Sheet drawer.
2. **`TileMenu`** — Cortex tile selector (sekcja "Tiles") + IDP sub-menu (Dashboard, Packages, Import, Audit Log, Classification, Rule Editor). Footer slot dla UserMenu. Placeholder na przyszłe kafelki.
3. **`DetailLayout`** — PageHeader + Tabs + content, sticky header przy scrollu.
4. **App routing stubs**: `app/idp/app/(main)/{dashboard,packages,import,audit-log,classification,rules}/page.tsx` — wszystkie pokazują tylko `<PageHeader />` + `<EmptyState title="Coming soon" />` na razie.

**Done:** klikanie w menu przełącza trasy, shell stabilny, layout respektuje tokeny.

---

### Wave 5 — Mock backend (1 day)

**Cel:** MSW handlery dla wszystkich 28 endpointów, realistic fixtures.

1. **Fixtures** (`app/idp/mocks/fixtures/`):
   - 50 packages w różnych stanach (7 `ProcessingState` × verification pokrycie)
   - Po kilka action logów na package (wszystkie 18 `PackageActionType`)
   - Sample transport orders + invoice lines
   - Export templates
   - User preferences (`document_panel_ratio`)
   - Audit log fixtures (200 entries z payloadami)

2. **Handlers** (`app/idp/mocks/handlers.ts`): wszystkie 28 endpointów z `api-contract.md`. Pagination, filter, sort — działają na fixtures.

3. **Demo dynamic**: jeden mock package z state auto-postępującym co 10s (`imported` → `analysing` → `ready`) żeby auto-refresh był widoczny w demo.

4. **Auth**: credentials login zawsze succeed (fake), `/api/auth/session` zwraca fake usera.

5. **Error scenarios**: jeden package z `analysis_failed` + ErrorCode w payload, jeden z `imported_with_error`. Żeby ErrorState był testowalny.

**Done:** `NEXT_PUBLIC_API_MOCKING=enabled npm run dev` → pełna data płynie do UI.

---

### Wave 6 — Screens (4 days)

Parallelizable gdy Lego gotowe. Jeden ekran dziennie.

**Day 9 — Dashboard + Packages list**

- **Dashboard** (`app/idp/app/(main)/dashboard/page.tsx`):
  - 5 × `DataCard` (In Queue+Processing, Ready, In Verification, Verified, Failed) — z `usePackagesStatsQuery`
  - `DataTable` z last-5 packages + `StatusBadge` + row action Details
  - TanStack Query `refetchInterval: 5000`

- **Packages** (`app/idp/features/packages/`):
  - `PackageFilters` (status select, search, sort by, sort order, date range, optional custom status)
  - `DataTable` z selection, bulk delete (`AlertDialog` confirm), pagination, row actions (Details → router push, `ExportMenu`)
  - `PackageStatusChip` wrapper nad StatusBadge (processing + verification combined)
  - Filter state w Zustand, URL sync przez searchParams

**Day 10 — Package Details** (najbardziej skomplikowany)

`app/idp/features/package-details/`:

- `DetailLayout` z 4 tabami: Overview | Analysis Result | Action Log | Source Materials
- **Overview tab**: PackageStatusChip + metadata cards (imported date, size, tokens/cost) + `PackageActionButtons` (reads `/transitions`, renderuje enabled buttons z confirm dialogs) + Reprocess dialog (fast toggle + ai-context) + Download ZIP + Show Structure modal (JsonViewer 640px) + Export dropdown z warnings dialog (block na errors, "Export Anyway" przy warnings) + User Notes card
- **Analysis Result tab**: `JsonViewer` gdy nie verification OR nie assignee; `JsonEditor` (P1) gdy verification in progress + email matches assignee (case-insensitive compare z `useSession().user.email`)
- **Action Log tab**: `ActionLogTimeline` — full log, no pagination, payload expandable
- **Source Materials tab**: `DocumentViewer` z navigation + SVG overlay placeholder (BoundingBoxOverlay P1)
- **Side-by-side mode** (verification + `enable_document_preview`): `react-resizable-panels` z persisted ratio via `/api/user-preferences` (`document_panel_ratio` z enumu 0.3/0.4/0.5/0.6/0.7)
- **`AutoRefreshIndicator`**: pause gdy `verification_state === "in_progress"` OR editing reprocess context (z `streamlit-ux-map.md` §2.4)
- **Email-gating**: `canEdit = session.user.email.toLowerCase() === assignee.email.toLowerCase()` — wszędzie forward do JsonEditor/forms

**Day 11 — Import + Audit Log**

- **Import** (`app/idp/features/import/`):
  - 2 niezależne sekcje: "Import ZIP Package" + "Import Files"
  - Każda: `FileUploader` + "Fast processing" checkbox + "Additional AI context" checkbox + textarea (walidacja: non-empty gdy ticked)
  - Client-side zipping dla multi-file (użyj browser-native `CompressionStream` lub małą libkę — decyzja w momencie implementacji)
  - Submit → mutation → toast → reset uploader

- **Audit Log** (`app/idp/app/(main)/audit-log/page.tsx`):
  - 4-column filter row (action type, performed by, from date, to date) — filter change resetuje page 0
  - Manual Refresh button (no auto-refresh)
  - `DataTable` z expandable payload rows (`Accordion` w cellu)
  - Pagination footer

**Day 12 — Classification/Rules stubs + polish + E2E**

- **Classification** + **Rule Editor**: `PageHeader` + `EmptyState title="Coming soon" description="..."`. Menu już wskazuje — ekrany tylko do zajęcia slotu.
- **Polish**: framer-motion na modals (fade+scale), accordion (height auto), toast enter/exit. Keyboard: ESC close, Enter submit form.
- **Playwright E2E**: 1 golden path (login → packages list → details → back). `npx playwright test` zielone na dev server + MSW.

**Done:** prototyp demo-ready.

---

### Wave 7 — Verification + handoff (0.5 day buffer)

1. Full browser walkthrough — wszystkie 5 ekranów + 2 stuby
2. `npm run typecheck` clean
3. `npm run lint` clean
4. `npm run test` clean
5. `npm run build` — sprawdzenie że `.next/standalone` zawiera `libs/@cortex/*` (kluczowa weryfikacja `outputFileTracingRoot`)
6. Docker smoke test: `docker build` + `docker run` na localhost
7. Update root `README.md` z instrukcjami uruchomienia
8. Zaproś Patryka i Huberta do review — link do Ladle + link do live demo + `docs/frontend-architecture.md`

---

## 3. Residualne decyzje (do potwierdzenia w locie)

1. **ConfidenceBadge** — brak w openapi. Budujemy P1 jako mock-only (klasyfikacja w przyszłości). Jeżeli backend nigdy nie doda scorów — kill w v0.2.
2. **ThemeToggle** — P1. Prototyp może jechać dark-only + toggle w Wave 7 jeśli czas.
3. **BoundingBoxOverlay** — P1. Mock SVG w Source Materials tab, rzeczywiste highlighty gdy backend da koordynaty.
4. **JsonEditor** (inline-editable verification) — P1. MVP może pokazywać `JsonViewer` + komunikat "Edit in Streamlit" gdy verification in progress. Pełna implementacja gdy zostanie czas.
5. **Client-side zipping** — natywne `CompressionStream` vs mała libka (jszip). Decyzja w Day 11.
6. **Export warnings dialog** — severity-colored list (red = error blocker, orange = warning). Używa `Dialog` + `Alert`.

---

## 4. Red flagi z risercza — jak adresujemy

| Red flag                                         | Źródło | Mitygacja w planie                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `analysis_result` nietypowany w openapi          | R2     | W `@cortex/types` modelujemy jako `unknown`; `JsonViewer`/`JsonEditor` bierze `unknown`; schema Zod dopisujemy w `app/idp/features/verification/schemas.ts` z tego co wiemy ze Streamlita (seller, buyer, transport_info, invoice_header, delivery_terms, totals, lines) |
| Mutations zwracają `{}`                          | R2     | TanStack Query: po każdej mutacji `invalidateQueries` na relevant key. Brak optimistic updates na start.                                                                                                                                                                 |
| Money/weight jako string                         | R2     | `@cortex/utils/formatters` — `formatMoney(v: string)`, walidacja Zod `.string().regex(/^-?\d+(\.\d+)?$/)`. **Nigdy** `Number(v)` w formach.                                                                                                                              |
| Auth header niezadeklarowany w openapi           | R2     | Ręczne wstawienie w `@cortex/api.apiClient` przez `buildAuthHeaders(session)` — swap point do real proxy udokumentowany.                                                                                                                                                 |
| State machine inferowalna, niezadeklarowana      | R2     | **Nie budujemy client-side machine.** `PackageActionButtons` renderuje ENABLED only te, które przyszły z `/transitions` endpoint. Brak gadania.                                                                                                                          |
| Polling nie może stomp user input                | R1     | `AutoRefreshIndicator` + explicit `enabled` prop kontrolowany przez `verification_state` i `editingReprocessContext` state.                                                                                                                                              |
| Monochrome design, słabo rozpoznawalne tiles     | R3     | Per-tile accent override — IDP dostaje `--accent-tile` CSS var. W Wave 4 (TileMenu) zdefiniuj gradient/kolor per-tile w metadata.                                                                                                                                        |
| `outputFileTracingRoot` musi wskazywać repo root | R5     | W `next.config.ts` ustawione (`repo-setup.md` §5). Weryfikacja Docker build w Wave 7.                                                                                                                                                                                    |
| PackageActionType nadzbiorem PackageStatus       | R2     | Nie equate. W `StatusBadge` używamy `ProcessingState`/`VerificationState`; w `ActionLogTimeline` używamy `PackageActionType`. Rozdzielone typami.                                                                                                                        |

---

## 5. Success criteria (done = merge to main)

- [ ] 5 ekranów IDP funkcjonalne z mock data (Dashboard, Packages, Import, Package Details, Audit Log)
- [ ] Classification + Rule Editor pokazują EmptyState, menu je zawiera
- [ ] Auth: unauthenticated → redirect login → "Continue as Demo User" → session aktywny
- [ ] Verification email-gating respektuje przypadek-niewrażliwie
- [ ] Polling pauzuje podczas verification in progress
- [ ] Playwright E2E: import → list → details zielone
- [ ] `npm run typecheck` + `lint` + `test` green
- [ ] Docker `build` + `run` produkuje działający obraz
- [ ] Ladle ma stories dla wszystkich 40 P0 komponentów w `@cortex/ui`
- [ ] Hand-off review: Patryk + Hubert zaakceptowali lub dali konkretne issues

---

## 6. Ryzyka implementacyjne

1. **shadcn CLI + `@cortex/ui` alias** — może nie akceptować custom dest. Fallback: ręczny copy-paste z `shadcn-ui/ui` repo. **P=20%, Impact=Low** (kilkadziesiąt minut extra).
2. **MSW boot order z QueryClientProvider** — udokumentowane, ale łatwo pomylić tree order. **P=30%, Impact=Low**.
3. **`react-resizable-panels` + server preferences persist** — sync user preference load przed pierwszym renderem split. **P=30%, Impact=Low** (loading state bridges).
4. **`docx-preview` + `xlsx` lazy-loading w Next 15** — mogą wymagać custom webpack config. **P=20%, Impact=Medium** (1h debug).
5. **pdfjs worker path w production** — działa w dev przez copy script, prod Docker wymaga weryfikacji. **P=40%, Impact=Medium** (Wave 7 Docker smoke).
6. **Estymat slippage** — pierwszy raz robię ten konkretny stack tej wielkości. **P=50%, Impact=Medium** (buffer Day 13).

---

## 7. Approval checkpoints

- **Po Wave 4 (AppShell + TileMenu ready):** krótki screenshot/demo dla Cezarego. Jeżeli look & feel nie pasuje — cheaper adjust tokens niż re-skin screens.
- **Po Wave 6 Day 10 (Package Details ready):** demo verification flow. Najbardziej złożony ekran, dobrze zweryfikować nawet wcześnie.
- **Wave 7:** formal handoff do Patryka + Huberta.

---

## 8. Co NIE jest w tym planie (świadomie)

- Real backend integration (MSW purely)
- Real auth / SSO (fake user, swap points oznaczone)
- Full a11y audit (shadcn daje baseline, ale audit out of scope)
- Performance profiling (React Profiler → optymalizacja dopiero gdy zmierzymy problem)
- Rule editor logic (tylko placeholder)
- Classification DnD logic (tylko placeholder)
- Cost allocation logic
- Multi-tenant / org switching
- E2E coverage poza jednym golden pathem
- CI/CD setup (repo jest lokalny, Docker build ręczny na Wave 7)
- Storybook / Chromatic (mamy Ladle dla dev, Chromatic out of scope)
