# Next steps — Cortex Frontend

> Resumable handoff. Read `CLAUDE.md` + `architecture_rules.md` + `docs/work/STATUS.md` first. Then this.

## Quick context

Cortex Frontend = monorepo frontend platformy Cortex. IDP to pierwszy kafelek. Port ze Streamlita na Next.js 15 + shadcn/ui. Wszystko klient (no RSC). MSW mockuje całe API 1:1 z Pydantic contracts w `idp-next-prototype/idp_app/src/shared/contracts/` (NIE openapi.json — ten jest stale). Dane pasują do prod backendu byte-for-byte.

Branch: `main` (lokalny git). Commity:
- `55e89c4` initial prototype
- `0a4a8b4` simplify refactor
- `ebf73e0` Wave 7-9: backend alignment + viewers + dark mode + error boundaries
- `2e76cbd` Wave 10: custom status/notes, export menu, dashboard overflow fix
- `7a97f9c` Wave 11: bulk delete + columns dedup
- `ec89190` Wave 12: user preferences sync, resizable viewer, FileUploader controlled
- `6f386a4` Wave 13: additional AI context in Import
- `5ef7aee` Wave 14: reprocess dialog + shared import options

## Uruchomienie (fresh session)

```bash
cd /Users/cez/P/new_cortex/cortex_frontend
npm install          # jeśli node_modules nie ma
npm run msw-init     # regeneruje app/idp/public/mockServiceWorker.js
npm run pdf-assets
npm run dev          # http://localhost:3000
```

Wymagane pliki nie w gitze: `app/idp/.env.local` z `AUTH_SECRET=<cokolwiek 32+ znaków>` i `NEXT_PUBLIC_API_MOCKING=enabled`. Login = "Continue as Demo User".

Weryfikacja: `npm run typecheck`, `npm run lint`, `npm run build`.

## Co JEST zrobione

- **Wave 0-4** pełne (foundations, shared packages, 23 primitives, 15 compositions, layouts)
- **Wave 5 (MSW):** 30/30 endpointów, fixtures (54 packages), state machine, memoized action logs
- **Wave 6 screens:** Dashboard, Packages list, Package Details, Import, Audit log, Classification stub, Rules stub, Login
- Topbar: sidebar collapse (Zustand + persist), breadcrumbs z pathname, `⌘K` CommandPalette z debounced search, UserMenu
- Auth: NextAuth v5 beta z fake user + 6 swap pointami dla SSO
- Design: tokeny z shadcnuidashboard.com/logistics, score 34→~45/50 po fixach
- Prod build działa — standalone Docker-ready (`outputFileTracingRoot` ustawiony)

## Autorytatywne źródło prawdy dla API

**`idp-next-prototype/idp_app/src/shared/contracts/`** — Pydantic contracts. `openapi.json` jest stale (reklamuje `status`, live model ma two-axis). Gdy zmieniasz types — czytaj Pydantic, nie openapi.

Kluczowe pliki:
- `package_contracts.py` — `PackageReadModel`, `DashboardStatsResponse`, etc.
- `package_enums.py` — `ProcessingState`, `VerificationState`, `PackageActionType`, `PackageTransition`
- `api/package/router.py` — endpointy i query params

## Wave plan (plany i priorytety)

### Wave 7 — Backend API alignment (P0) ✅

Two-axis state model + extended action types, oparty o Pydantic contracts.

- **7.1** ✅ Split `PackageStatus` → `ProcessingState` + `VerificationState`. Zaktualizowane: `@cortex/types`, `PackageStatusBadges` (dwa badge'y z separatorem), fixtures (phases zamiast statusów), MSW handlers (computeStats two-axis, transition logic + assignee check), Packages list (dwa selecty), Dashboard stats mapping, Package Details (canEdit po `verification_state === "in_progress"` + assignee).
- **7.2** ✅ `PACKAGE_ACTION_TYPE` rozszerzony o `sad_context_updated`, `custom_status_updated`, `user_notes_updated`, `deleted`, `restored`. `ActionLogTimeline` ma ikonki i labelki.
- **7.3** ✅ Dopasowane do Pydantic contracts:
  - query params: `processing_state`, `verification_state`, `custom_status`
  - request types: `SetCustomStatusRequest`, `SetUserNotesRequest`, `DeletePackagesRequest`, `ReprocessRequest`
  - nowe endpointy + hooki: `useSetCustomStatus`, `useSetUserNotes`, `useDeletePackages`, `useRestorePackage`, `usePackageSourceFiles`, `useExportTemplates`, `endpoints.packages.validateExport/exportResult/sourceFileContent`
  - import endpoint teraz bierze full body (`ImportPackageBody` z `fast_processing` + `additional_ai_context`)
  - dashboard stats shape identyczny jak backend (`DashboardStatsResponse`)

### Wave 8 — P1 features ✅

- **8.1** ✅ **DocumentViewer** (`@cortex/ui/components/document-viewer`). PDF via `react-pdf` + `pdfjs-dist` (worker `/pdfjs/pdf.worker.min.mjs`), DOCX via `docx-preview`, XLSX via SheetJS (multi-sheet tabs), image via object URL, unsupported → fallback message. Detection via mediaType + extension. **BEZ eager reexportu z `@cortex/ui` index** — pdfjs wali SSR (`DOMMatrix`); import przez subpath + `next/dynamic({ ssr: false })`. Integracja przez `SourceMaterialsPanel` (lista z `/source-files` + viewer z `/source-files/content`).
- **8.2** ✅ **JsonEditor** (`@cortex/ui`) — textarea z walidacją JSON, diff indicator (`dirty`), Revert. Integracja w Package Details, gdy `canEdit = emailsMatch(session, assignee) && verification_state === "in_progress"`. **Caveat:** backend nie ma endpointu dla full-document save — `finish-verification` nie bierze body, `verified_result` update idzie przez transport-order sections (updateSeller/updateBuyer/updateInvoice/etc.). Save button disabled z `disabledReason`. Wiring do transport-orders = P3 (trzeba dekomponować JSON → sekcje albo dodać nowy endpoint backendu).
- **8.3** ✅ **Dark mode toggle** — `ThemeToggle` composition w `@cortex/ui` + `useThemeStore` (Zustand persist, `light | dark | system`) + `ThemeProvider` (matchMedia sync dla `system`). Wire w Topbar. `.dark` tokens w `@cortex/styles/globals.css` już były obecne. **Wizualna weryfikacja przez użytkownika wymagana** — build zielony, toggle działa przez DOM (CSS klasa `.dark` na `<html>`).

### Wave 9 — Refactor ✅

- **9.1** ✅ **`react-error-boundary`** (npm `react-error-boundary@^6.1.1`). Trzywarstwowo per `architecture_rules.md §9`:
  - `RootErrorBoundary` w `app/layout.tsx` — fullscreen fallback z linkiem do `/` + retry; ChunkLoadError detection (full reload prompt).
  - `FeatureErrorBoundary` w `(main)/layout.tsx` — wewnątrz AppShell, reset po zmianie `pathname`, zintegrowany z `QueryErrorResetBoundary` żeby TanStack Query cache też się resetował.
  - Reuse `ErrorState` composition jako UI.

### Wave 10 — User-facing features (backend ready) ✅

- **10.1** ✅ **Custom status + user notes** inline edit (`PackageMetadataEditors`) w Package Details. Hooki `useSetCustomStatus` / `useSetUserNotes` + cache invalidation.
- **10.2** ✅ **Export templates dropdown** (`ExportMenu`) w Package Details Actions. `/export-templates` → `/export?template=`, download przez Blob + object URL.
- **10.3** ✅ **Dashboard overflow** — tiles używają `grid-cols-[repeat(auto-fit,minmax(160px,1fr))]`, adaptują się zamiast wyjeżdżać za viewport.

### Wave 11 — Bulk actions + dedup ✅

- **11.1** ✅ **Bulk delete** w Packages list: row selection (`Set<string>`) z per-page "select all", bar "X selected" + `AlertDialog` confirmation + `useDeletePackages`.
- **11.2** ✅ **ColumnDef dedup** — `lib/columns/packages.tsx#packageColumns(options)` z opcjami `includeId` + `selection`. Dashboard + Packages używają jednego builder'a.

### Wave 12 — User preferences sync + polish ✅

- **12.1** ✅ **User preferences sync** (`/user/preferences`): types + endpoints + hooki (`useUserPreferences` / `useSetUserPreferences`). `ThemeProvider` adopuje remote `theme_mode` przy pierwszym load, Topbar persystuje lokalne zmiany do backendu. MSW mock w-memory.
- **12.2** ✅ **Resizable source materials split** — `react-resizable-panels` w `SourceMaterialsPanel`. Ratio ładowany/zapisywany przez `document_panel_ratio` preference (clamp 0.3–0.7).
- **12.3** ✅ **FileUploader controlled mode** — opcjonalne `value` + `onChange` alongside existing uncontrolled `onFilesSelected`. Import page używa full controlled.

### Wave 13 — Additional AI context in Import ✅

- Toggle + textarea (max 4000 chars) w Import page, per upload card. Wiring do `additional_ai_context_enabled` + `additional_ai_context` w `ImportPackageBody` / `ImportMultiplePackagesBody`. Guard pustego textarea przy enabled.

### Wave 14 — Reprocess dialog + shared options ✅

- `ImportOptionsFields` + `useImportOptions` hook wydzielone do `app/idp/components`. Import page + `ReprocessDialog` używają tego samego komponentu.
- `ReprocessDialog` w Package Details — reprocess button otwiera dialog z `fast_processing` + AI context, zamiast pustego body.

### P3 — deferred (backend-blocked or explicitly skipped)

- **BoundingBoxOverlay** (SVG over PDF) — wymaga backend coordinates z analysis_result. Explicit skip.
- **Feature flags util** per `§11`. Explicit skip.
- **Playwright E2E** golden path. Explicit skip.
- **JsonEditor save wiring** — dekompozycja JSON na transport-order section updates (`updateSeller/Buyer/Invoice/etc.`) albo nowy backend endpoint dla full-document save. UI gotowe, wiring blokowane przez backend.
- **Framer-motion** transitions na modale/accordion — Radix już ma CSS animations. Skip do czasu konkretnej potrzeby.
- **Rule editor + Classification DnD** — brak backend endpointów (`grep rule/classification` w `idp_app/src/api/` = 0 wyników). Stuby "coming soon" są zgodne z backendem.
- **Restore UI** — hook `useRestorePackage` gotowy, ale `/packages/get_all` nie pokazuje soft-deleted. Wymaga backend `include_deleted` filter albo osobnego endpointu listingu.
- **AppShell + TileMenu `collapsed` prop** consolidation przez SidebarProvider — premature (tylko IDP, drugi kafelek jeszcze nie istnieje).

## Znane gotcha / niuanse

- **`.env.local` jest w `app/idp/`, nie w root.** Next.js czyta env z project dir (passowanego do `next dev app/idp`), nie z CWD.
- **Breadcrumby są w Topbar, nie w PageHeader.** Każda strona daje tylko `title + description`.
- **Polling na Package Details pauzuje gdy `verification_state === "in_progress"`** (Streamlit parity — nie stomp over user input).
- **Money / weight / quantity to stringi, nie numbers.** `@cortex/utils/money.ts` — `formatMoney(value: string)`, NIGDY `Number(v)`.
- **Mutations zwracają `{}`** — hooki w `@cortex/api` invalidują query cache po success.
- **State machine jest serwerowa.** `PackageActionButtons` renderuje tylko transitions zwrócone przez `/transitions` endpoint.
- **Verification edit email-gated, case-insensitive.** `emailsMatch(session.user.email, package.assignee)` z `@cortex/utils/email.ts`.
- **MSW worker file musi być pod `public/mockServiceWorker.js`**, middleware go omija.
- **`outputFileTracingRoot` w `next.config.ts`** musi wskazywać repo root. Inaczej `.next/standalone` nie ma `libs/@cortex/*`.
- **shadcn CLI działa z custom layoutem** — `npx shadcn add <name>` ląduje w `libs/@cortex/ui/src/components/ui/`.
- **Auth header = `x-auth-request-email`** (case-insensitive, lowercase normalized). Brak tokenu, email-based identity.

## Dokumenty — must-read dla resume

W kolejności ważności:
1. `docs/work/STATUS.md` — top-level snapshot projektu
2. **`idp-next-prototype/idp_app/src/shared/contracts/`** — autorytatywny API model (zamiast openapi.json)
3. `docs/work/implementation-plan.md` — oryginalny 7-wave plan
4. `docs/work/api-compatibility-audit.md` — historyczny audit
5. `docs/work/look-and-feel-review.md` — P1 gapy vs reference
6. `docs/frontend-architecture.md` — decyzje stackowe + uzasadnienia
7. `architecture_rules.md` — reguły (§9 error handling, §11 feature flags)
8. `docs/work/lego-blocks.md` — prop sketche dla P1 komponentów

## Roles (dla feedbacku)

- **Patryk** — architektura monorepo, stack decisions, error handling §9
- **Hubert** — API integracja (backend drift już rozwiązany w Wave 7 — two-axis state live)
- **Ani** — design review; za mało kolorowe ale "od czegos trzeba zaczac"

## Gdy resume'ujesz

1. `cd /Users/cez/P/new_cortex/cortex_frontend && git status` — sprawdź czy clean
2. `cat docs/work/STATUS.md` — zobacz snapshot
3. Zapytaj co jest next albo weź aktywną Wave z góry listy
4. NIE commituj bez explicit "zrob commita"
5. Follow `architecture_rules.md`: wszystko `"use client"`, strict TS, shadcn w `@cortex/ui`, minimal diff, no auto-.md
6. Gdy dotykasz API / types — czytaj Pydantic z `idp-next-prototype/idp_app/src/shared/contracts/`, nie openapi.json

🖤
