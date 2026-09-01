# Lego Blocks — `/libs/@cortex/ui` Inventory

**Status:** Draft v0.1
**Autor:** Cezary
**Data:** 2026-04-20
**Scope:** Component inventory BEFORE screen work. Lego-first: no screen starts until the relevant primitives + compositions are green.

---

## Zasady gry

- **Tier 1 primitives** — shadcn/ui copy-paste albo cienki wrapper. Zero business logic.
- **Tier 2 compositions** — składane z Tier 1. Reużywalne między kafelkami Cortex.
- **Tier 3 layouts** — szkielety stron.
- **Tier 4 IDP-specific** — zostaje w `/app/idp/components/` albo `/app/idp/features/*/components/`. **NIE** wędruje do `@cortex/ui`.
- **Naming:** `kebab-case` pliki, `PascalCase` komponenty. Każdy komponent z Tier 1/2/3 ma `.stories.tsx` (Ladle).
- **Dependency rule:** Tier N może zależeć tylko od Tier <N. Brak cross-tier chaosu.
- **Dark mode:** każdy komponent respektuje tokeny z `@cortex/styles` (`bg-background`, `text-foreground`, itd.). Zero hardcoded kolorów.

---

## Tier 1 — Pure primitives

Wszystkie przez `shadcn@latest add <component>` do `/libs/@cortex/ui/components/*`, chyba że oznaczone jako **wrap**.

| Component      | Source                 | Purpose                                  | Variants                                                                                     | Prio | Deps               |
| -------------- | ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ------------------ |
| `Button`       | shadcn                 | Akcje                                    | `default` / `destructive` / `outline` / `secondary` / `ghost` / `link`; size `sm/md/lg/icon` | P0   | Radix Slot         |
| `Input`        | shadcn                 | Text input                               | `default` / `error`; `sm/md`                                                                 | P0   | —                  |
| `Textarea`     | shadcn                 | Multiline (notes)                        | `default` / `error`                                                                          | P0   | —                  |
| `Label`        | shadcn                 | A11y label                               | —                                                                                            | P0   | Radix Label        |
| `Select`       | shadcn                 | Single select (filters, enums)           | `default` / `inline`                                                                         | P0   | Radix Select       |
| `Combobox`     | wrap (Command+Popover) | Searchable select (assignee)             | `single` / `multi`                                                                           | P1   | `cmdk`             |
| `Checkbox`     | shadcn                 | Row selection                            | `default` / `indeterminate`                                                                  | P0   | Radix Checkbox     |
| `RadioGroup`   | shadcn                 | Exclusive choice                         | `default`                                                                                    | P1   | Radix RadioGroup   |
| `Switch`       | shadcn                 | Toggle (auto-refresh, flags)             | `default`                                                                                    | P0   | Radix Switch       |
| `Dialog`       | shadcn                 | Modal                                    | `default` / `large` / `fullscreen`                                                           | P0   | Radix Dialog       |
| `AlertDialog`  | shadcn                 | Destructive confirm                      | `default` / `destructive`                                                                    | P0   | Radix AlertDialog  |
| `Sheet`        | shadcn                 | Drawer (filters, mobile nav)             | `left` / `right` / `top` / `bottom`                                                          | P0   | Radix Dialog       |
| `DropdownMenu` | shadcn                 | Row actions, user menu                   | `default` / `with-submenu`                                                                   | P0   | Radix DropdownMenu |
| `Popover`      | shadcn                 | Date picker host, inline edit            | `default`                                                                                    | P0   | Radix Popover      |
| `Tooltip`      | shadcn                 | Icon-button labels                       | `default` / `delayed`                                                                        | P0   | Radix Tooltip      |
| `Tabs`         | shadcn                 | Package detail sections                  | `default` / `underline` / `pill`                                                             | P0   | Radix Tabs         |
| `Accordion`    | shadcn                 | Collapsible action log payload           | `single` / `multiple`                                                                        | P1   | Radix Accordion    |
| `Badge`        | shadcn                 | Generic label                            | `default` / `secondary` / `outline` / `destructive`                                          | P0   | —                  |
| `Card`         | shadcn                 | Bordered container                       | `default` / `ghost` / `elevated`                                                             | P0   | —                  |
| `Separator`    | shadcn                 | Divider                                  | `horizontal` / `vertical`                                                                    | P0   | Radix Separator    |
| `ScrollArea`   | shadcn                 | Custom-scrollbar region                  | `default`                                                                                    | P0   | Radix ScrollArea   |
| `Progress`     | shadcn                 | Upload / analysis progress               | `default` / `indeterminate`                                                                  | P1   | Radix Progress     |
| `Skeleton`     | shadcn                 | Loading placeholder                      | `text` / `avatar` / `box`                                                                    | P0   | —                  |
| `Toaster`      | wrap sonner            | Toast host (API: `toast()`)              | `success/error/info/warning`                                                                 | P0   | `sonner`           |
| `Avatar`       | shadcn                 | User avatar                              | `sm/md/lg` + fallback                                                                        | P0   | Radix Avatar       |
| `Breadcrumb`   | shadcn                 | Header trail                             | `default` / `with-icon`                                                                      | P0   | —                  |
| `Alert`        | shadcn                 | Inline banner                            | `default` / `destructive` / `warning` / `info`                                               | P0   | —                  |
| `Command`      | shadcn                 | Command palette prim. (Combobox, search) | `default`                                                                                    | P1   | `cmdk`             |
| `Calendar`     | shadcn                 | Date picker                              | `default` / `range`                                                                          | P1   | `react-day-picker` |
| `Slider`       | shadcn                 | Range input (zoom, threshold)            | `default` / `range`                                                                          | P2   | Radix Slider       |

---

## Tier 2 — Compositions

Każdy komponent w `/libs/@cortex/ui/components/<name>/` z `index.ts`, `<name>.tsx`, `<name>.stories.tsx`, opcjonalnie `<name>.test.tsx`.

### `DataTable`

TanStack Table v8 wrapper. Sticky header, virtualization (via `@tanstack/react-virtual` gdy `rows > 200`), row selection, column visibility, sort indicators, empty/loading slots. Server pagination jest ownership ekranu — DataTable renderuje footer gdy dostanie `totalCount + onPageChange`. Columns w osobnym `columns.ts`.

```ts
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  emptyState?: ReactNode
  enableRowSelection?: boolean
  onRowClick?: (row: TData) => void
  virtualize?: boolean // default: data.length > 200
  stickyHeader?: boolean // default true
  getRowId?: (row: TData) => string
  totalCount?: number // server-pag mode
  onPageChange?: (page: number, pageSize: number) => void
}
```

**Deps:** `@tanstack/react-table`, `@tanstack/react-virtual`, Tier 1 (Checkbox, Button, DropdownMenu, Skeleton). **Priority:** P0.

### `FormField`

RHF + Zod + shadcn wrapper. Label, input slot, error, description. Eliminuje `register()` boilerplate, pole dostaje się przez `render` prop.

```ts
interface FormFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  required?: boolean
  render: (field: ControllerRenderProps<T>) => ReactNode
}
```

**Deps:** `react-hook-form`, Tier 1 (Label). **Priority:** P0.

### `StatusBadge`

Typed badge nad unią `ProcessingState | VerificationState`. Kolor + ikona + label. Własna mapa kolorów (nie reużywa `Badge` variantów).

```ts
type ProcessingState =
  "imported" | "imported_with_error" | "analysing" | "analysis_failed" | "ready"
type VerificationState = "not_started" | "in_progress" | "completed"
interface StatusBadgeProps {
  kind: "processing" | "verification"
  state: ProcessingState | VerificationState
  size?: "sm" | "md"
  showIcon?: boolean
}
```

Mapa: `imported`→blue, `analysing`→violet, `ready`/`completed`→green, `analysis_failed`→red, `imported_with_error`→amber, `in_progress`→amber. **Deps:** Tier 1 (Badge), `lucide-react`. **Priority:** P0.

### `ConfidenceBadge`

LLM confidence score (0–1 lub 0–100). Gradient green→amber→red z konfigurowalnymi thresholdami.

```ts
interface ConfidenceBadgeProps {
  value: number // 0-1 lub 0-100 (auto-detect)
  thresholds?: { high: number; medium: number } // default 0.9 / 0.7
  size?: "sm" | "md"
  showPercent?: boolean
}
```

**Deps:** Tier 1 (Badge, Tooltip). **Priority:** P1.

### `EmptyState`

Ikona + tytuł + opis + opcjonalna akcja.

```ts
interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void } | ReactNode
  size?: "sm" | "md" | "lg"
}
```

**Deps:** Tier 1 (Button). **Priority:** P0.

### `LoadingState`

Wariantowy loader: `spinner` (inline), `skeleton` (shape-matched), `overlay` (backdrop nad content).

```ts
interface LoadingStateProps {
  variant: "spinner" | "skeleton" | "overlay"
  label?: string
  rows?: number // skeleton only
}
```

**Deps:** Tier 1 (Skeleton), `lucide-react`. **Priority:** P0.

### `ErrorState`

API/render błąd z opcjonalnym retry. Komplementarny do ErrorBoundary, nie zastępuje go.

```ts
interface ErrorStateProps {
  title?: string
  message?: string
  errorCode?: string // @cortex/api ErrorCode
  onRetry?: () => void
  variant?: "inline" | "page"
}
```

**Deps:** Tier 1 (Alert, Button). **Priority:** P0.

### `Stepper`

Horizontal stepper: active/completed/pending. Import + verification flow.

```ts
interface StepperProps {
  steps: { id: string; label: string; description?: string }[]
  currentStepId: string
  completedStepIds?: string[]
  orientation?: "horizontal" | "vertical"
  onStepClick?: (id: string) => void
}
```

**Deps:** `framer-motion` (opt), `lucide-react`. **Priority:** P1.

### `ActionLogTimeline`

Lista eventów: ikona, timestamp, actor, summary, expandable payload (JSON). Package detail + audit log. Virtualized gdy > 100 items.

```ts
interface ActionLogEvent {
  id: string
  type: string // → icon + color mapping
  timestamp: string | Date
  performedBy: string
  summary: string
  payload?: unknown // expanded → JsonViewer
}
interface ActionLogTimelineProps {
  events: ActionLogEvent[]
  iconMap?: Record<string, LucideIcon>
  onEventClick?: (e: ActionLogEvent) => void
  virtualize?: boolean
}
```

**Deps:** Tier 1 (Accordion, Avatar), `JsonViewer`, `date-fns`. **Priority:** P0.

### `FileUploader`

DnD + click-to-browse. Single ZIP lub multi-file (opcjonalny client-side zipping). Per-file status (queued/uploading/success/error). Accept + size limits via props.

```ts
type FileStatus = "queued" | "uploading" | "success" | "error"
interface UploadItem {
  id: string
  file: File
  progress: number
  status: FileStatus
  error?: string
}
interface FileUploaderProps {
  accept?: string
  maxSizeMb?: number
  multiple?: boolean
  autoZipMultiple?: boolean // multiple + true → client-side zip
  onFilesSelected: (files: File[]) => void
  items?: UploadItem[] // controlled progress
}
```

**Deps:** Tier 1 (Progress, Button, Badge). Native `onDrop` (bez `@dnd-kit` — ten zostaje dla classification). **Priority:** P0.

### `JsonViewer`

Read-only tree: collapsible nodes, copy-node, lazy render dla dużych obiektów.

```ts
interface JsonViewerProps {
  data: unknown
  collapsed?: boolean | number // bool: all / number: depth
  maxHeight?: number
  onCopyNode?: (path: string[], value: unknown) => void
}
```

**Deps:** Tier 1 (ScrollArea, Button, Tooltip). Custom recursive renderer, brak dodatkowej libki. **Priority:** P0.

### `JsonEditor`

Inline editable tree dla verification. Bazuje na `JsonViewer` + edit per-node. Walidacja przez Zod (consumer dostarcza schema).

```ts
interface JsonEditorProps<T> {
  value: T
  schema?: ZodType<T>
  onChange: (next: T) => void
  onValidationChange?: (errors: ZodError | null) => void
  readOnlyPaths?: string[][]
}
```

**Deps:** `JsonViewer`, `zod`, Tier 1 (Input, Select, Button). **Priority:** P1.

### `CodeBlock`

Syntax-highlighted snippet (error payload, curl, rule DSL). MVP: regex highlighter dla JSON/XML; `shiki` lazy-loaded później.

```ts
interface CodeBlockProps {
  code: string
  language?: "json" | "ts" | "bash" | "xml" | "plain"
  copyable?: boolean
  maxHeight?: number
}
```

**Deps:** Tier 1 (Button, ScrollArea, Tooltip), opt. `shiki`. **Priority:** P1.

### `DocumentViewer` shell

Router wybiera viewer po MIME/extension. Każdy viewer lazy-loaded (`dynamic(() => import(...), { ssr: false })`). Toolbar slot (zoom/page nav).

```ts
type DocumentKind = "pdf" | "docx" | "xlsx" | "image" | "unknown"
interface DocumentViewerProps {
  url: string
  kind?: DocumentKind // auto-detect z URL
  page?: number // PDF only
  onPageChange?: (page: number) => void
  overlays?: ReactNode // SVG bbox slot
  hideToolbar?: boolean // default toolbar on; opt-out
  toolbarSlot?: ReactNode // override default
}
```

**Deps:** `react-pdf`, `pdfjs-dist`, `docx-preview`, `xlsx` — wszystko lazy. Tier 1 (ScrollArea, Button). **Priority:** P0 (shell + PDF), `docx`/`xlsx` mogą iść P1.

### `AutoRefreshIndicator`

Timer (5s default), pause/resume, countdown, manual refresh. Emituje `onTick` — konsument odpala TanStack Query refetch.

```ts
interface AutoRefreshIndicatorProps {
  intervalMs: number // default 5000
  enabled: boolean
  onTick: () => void
  onToggle?: (enabled: boolean) => void
  lastRefreshedAt?: Date
}
```

**Deps:** Tier 1 (Switch, Button, Tooltip), `lucide-react`. **Priority:** P0 (package detail wymaga).

### `PageHeader`

Tytuł + breadcrumb + actions slot. Opcjonalnie sticky.

```ts
interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: { label: string; href?: string }[]
  actions?: ReactNode
  sticky?: boolean
}
```

**Deps:** Tier 1 (Breadcrumb, Separator). **Priority:** P0.

### `DataCard`

Metryka dashboardowa: label + value + opcjonalny trend + ikona.

```ts
interface DataCardProps {
  label: string
  value: string | number
  trend?: { value: number; direction: "up" | "down" | "flat"; label?: string }
  icon?: LucideIcon
  isLoading?: boolean
  onClick?: () => void
}
```

**Deps:** Tier 1 (Card, Skeleton). **Priority:** P0.

### `UserMenu`

Avatar dropdown → email + logout. Czyta sesję z `useSession()` NextAuth; logout redirect przez prop.

```ts
interface UserMenuProps {
  logoutHref?: string // default "/logout"
  additionalItems?: { label: string; onClick: () => void; icon?: LucideIcon }[]
}
```

**Deps:** Tier 1 (Avatar, DropdownMenu), `next-auth/react`. **Priority:** P0.

### `ThemeToggle`

Light/dark/system, persist w localStorage. Dodaje `.dark` do `<html>`.

```ts
interface ThemeToggleProps {
  mode?: "icon" | "labeled"
}
```

**Deps:** Tier 1 (Button, DropdownMenu), Zustand store. **Priority:** P1 (prototyp może lecieć dark-only).

### `CopyButton`

Clipboard copy + toast. Używany w JsonViewer, CodeBlock, ID cellach tabeli.

```ts
interface CopyButtonProps {
  value: string
  successMessage?: string
  size?: "icon" | "sm"
}
```

**Deps:** Tier 1 (Button, Tooltip), `sonner`. **Priority:** P1.

### `DateDisplay`

Relative/absolute date + tooltip (`date-fns`).

```ts
interface DateDisplayProps {
  value: string | Date
  format?: "relative" | "absolute" | "both"
  tz?: string
}
```

**Deps:** Tier 1 (Tooltip), `date-fns`. **Priority:** P1.

---

## Tier 3 — Layout shells

### `AppShell`

Sidebar + topbar + main content. Sidebar collapsible (persist w Zustand + localStorage), responsive (`md` breakpoint → Sheet drawer). Main content `flex-1 min-h-0` dla virtualized tabel.

```ts
interface AppShellProps {
  sidebar: ReactNode // zwykle <TileMenu />
  topbar?: ReactNode
  children: ReactNode
  defaultCollapsed?: boolean
  sidebarWidth?: { collapsed: number; expanded: number } // default 64 / 240
}
```

**Deps:** Tier 1 (Sheet, ScrollArea, Button, Separator), Zustand. **Priority:** P0.

### `AuthLayout`

Centered card dla sign-in / error screens. Brand + content slot.

```ts
interface AuthLayoutProps {
  brand?: ReactNode
  children: ReactNode
  footer?: ReactNode
}
```

**Deps:** Tier 1 (Card). **Priority:** P1 (auth przez proxy, ale warto mieć).

### `DetailLayout`

Page header + tabs + content. Zapewnia sticky header gdy user scrolluje długi detail.

```ts
interface DetailLayoutProps {
  header: ReactNode // <PageHeader />
  tabs?: { id: string; label: string; badge?: ReactNode }[]
  activeTabId?: string
  onTabChange?: (id: string) => void
  children: ReactNode // active tab content
}
```

**Deps:** Tier 2 (PageHeader), Tier 1 (Tabs). **Priority:** P0.

### `TileMenu`

Cortex tile nav. API pod multi-tile od dnia zero. Sections (Platform / Tiles / Admin), active highlight, badge per-item (np. pending packages count).

```ts
interface TileMenuItem {
  id: string
  label: string
  icon: LucideIcon
  href: string
  badge?: string | number
  disabled?: boolean
}
interface TileMenuSection {
  id: string
  label?: string
  items: TileMenuItem[]
}
interface TileMenuProps {
  sections: TileMenuSection[]
  activeItemId?: string
  collapsed?: boolean
  footerSlot?: ReactNode // np. ThemeToggle + version
}
```

**Deps:** Tier 1 (Tooltip, Badge, ScrollArea), `lucide-react`, `next/link`. **Priority:** P0.

---

## Tier 4 — IDP-specific (NIE w `@cortex/ui`)

Zostają w `/app/idp/components/` lub `/app/idp/features/<feature>/components/`. Promujemy do `@cortex/ui` dopiero gdy drugi kafelek realnie tego zażąda.

| Component              | Location                   | Purpose                                                                       | Prio |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------------- | ---- |
| `PackageStatusChip`    | `components/`              | Wrapper nad `StatusBadge` z domenową mapą (processing + verification razem)   | P0   |
| `PackageActionButtons` | `features/packages/`       | Renderuje dostępne `PackageTransition` z API jako przyciski + confirm dialogs | P0   |
| `ExportMenu`           | `features/packages/`       | Dropdown: Download ZIP, Export JSON / CSV / XML, Download Result              | P0   |
| `PackageFilters`       | `features/packages/`       | Filters panel nad DataTable: status, assignee, date range, search             | P0   |
| `PackageSideBySide`    | `features/packages/`       | `DocumentViewer` + `JsonEditor`, resizable split                              | P0   |
| `ImportWizard`         | `features/import/`         | Stepper + FileUploader + submit → polling import status                       | P0   |
| `BoundingBoxOverlay`   | `components/`              | SVG highlight nad PDF (page, x, y, w, h) → scroll do pola                     | P1   |
| `InvoiceHeaderForm`    | `features/verification/`   | RHF form (seller, buyer, invoice no, dates, totals) + Zod                     | P1   |
| `InvoiceLinesEditor`   | `features/verification/`   | Inline-edit table; kandydat na Handsontable                                   | P2   |
| `TransportOrderEditor` | `features/verification/`   | Form: consignor, consignee, delivery terms                                    | P2   |
| `ClassificationBoard`  | `features/classification/` | DnD board (`@dnd-kit`) — dokumenty → grupy paczek. Reserve slot               | P2   |
| `RuleEditor`           | `features/rules/`          | Edytor reguł cost allocation. Reserve slot                                    | P2   |

---

## Build order (Lego-first plan)

**Wave 0 — Foundation (blokuje wszystko):** `@cortex/styles` (tokens, Tailwind config, CSS vars, light/dark), `@cortex/ui` setup (package.json, eslint/prettier, Ladle, shadcn CLI target), `@cortex/api` (`apiClient`, error mapping, MSW), `@cortex/types` (enums `ProcessingState`, `VerificationState`, `PackageTransition`, `PackageActionType`, `ErrorCode` + core read models).

**Wave 1 — Tier 1 P0 primitives** (parallel, 1-2 dni): Button, Input, Textarea, Label, Select, Checkbox, Switch, Dialog, AlertDialog, Sheet, DropdownMenu, Popover, Tooltip, Tabs, Badge, Card, Separator, ScrollArea, Skeleton, Toaster, Avatar, Breadcrumb, Alert.

**Wave 2 — Tier 2 P0 compositions** (zależą od Wave 1): StatusBadge, EmptyState, LoadingState, ErrorState, FormField, PageHeader, DataCard, DataTable, JsonViewer, ActionLogTimeline, AutoRefreshIndicator, FileUploader, UserMenu, DocumentViewer shell + PDF viewer.

**Wave 3 — Tier 3 layouts** (zależą od Wave 2): AppShell, TileMenu, DetailLayout.

**Wave 4 — Screens startują** (parallel):

- Dashboard → DataCard + DataTable + PageHeader.
- Package list → DataTable + PackageFilters + PackageStatusChip + ExportMenu.
- Package detail → DetailLayout + DocumentViewer + JsonViewer + ActionLogTimeline + PackageActionButtons + AutoRefreshIndicator.
- Import → ImportWizard + FileUploader.
- Audit log → DataTable + ActionLogTimeline (expandable rows).

**Wave 5 — P1/P2 dogrywki** (nie blokują screenów): Combobox, RadioGroup, Accordion, Progress, Calendar, Command, ConfidenceBadge, Stepper, JsonEditor, CodeBlock, ThemeToggle, CopyButton, DateDisplay, AuthLayout, DOCX/XLSX viewery, BoundingBoxOverlay, InvoiceHeaderForm.

**Critical path:** Wave 0 → DataTable + DocumentViewer + AppShell. Reszta równolegle.

---

## Ladle stories coverage

- Tier 1 P0 → `Default` + per-variant + `Disabled` (gdy applicable).
- Tier 2 P0 → `Default`, `Loading`, `Error`, `Empty` + 1 business scenario.
- Tier 3 → `Desktop`, `MobileCollapsed`, `WithLongContent`.

**Worth fixtures:**

- `DataTable` → `Simple` (10 rows), `Virtualized` (5000 mock), `WithSelection+RowActions`.
- `StatusBadge` → grid ze wszystkimi stanami processing + verification.
- `ActionLogTimeline` → fixture z wszystkimi `PackageActionType` variantami (icon mapping sanity-check).
- `FileUploader` → `EmptyDropZone`, `UploadInProgress`, `MixedSuccessError`.
- `DocumentViewer` → `PDF`, `DOCX`, `XLSX`, `Unknown`.
- `AppShell` → `Expanded`, `Collapsed`, `Mobile`.
- `JsonViewer` → `Flat`, `DeepNested`, `LargeArrays`.

**No stories dla Tier 4** — IDP app, nie design system. Testowane E2E (Playwright).

---

## Decisions to confirm

1. **`FileUploader` DnD** — native `onDrop` (prostsze), `@dnd-kit` tylko dla classification board. Confirm?
2. **`JsonEditor` vs typed forms** — dla verification proponuję free-form `JsonEditor` na start (parytet ze Streamlitem), typed formy (InvoiceHeaderForm) wchodzą w osobnej iteracji.
3. **`Stepper` priority** — import flow jedzie bez stepera (pojedynczy drop + status). Downgrade do P1. OK?
4. **`CodeBlock` highlighter** — regex MVP (JSON + XML), `shiki` gdy wejdzie rule DSL.
5. **`ThemeToggle`** — prototyp dark-only? Jeśli tak → P2. Decyzja Twoja.
6. **`BoundingBoxOverlay`** — zostaje IDP-specific (format związany z invoice extraction). Promujemy gdy drugi kafelek zażąda.
7. **`Combobox` P0/P1** — filtry package list jadą na `Select` + text input na start → P1.
8. **`DocumentViewer` toolbar** — default toolbar + `hideToolbar` opt-out, zamiast pure slot. Mniej boilerplate'u u konsumenta.
9. **`AppShell` persistence** — Zustand + `persist` middleware (localStorage). Bez cookies, bo nie używamy SSR.

---

**Next:** Confirmed → v0.2. Potem start Wave 0 (styles + ui package scaffold + api + types).
