# Frontend Architecture — IDP (Cortex Platform)

**Status:** Draft v0.1 — do weryfikacji
**Autor:** Cezary
**Reviewerzy:** Patryk, Hubert
**Data:** 2026-04-20
**Deadline na uwagi:** poniedziałek 12:00

> [!WARNING]
> **OBSOLETE od 29.07.2026** w części dot. struktury/workspace — patrz [docs/modular-monolith.md](modular-monolith.md) (aktualna reguła: modularny monolit, bez Multi-Zones, pnpm+turbo). Decyzje o stacku (Next.js/shadcn/Tailwind/TanStack/Zustand) niżej **nadal obowiązują** — nieaktualna jest tylko sekcja "Struktura — uproszczone monorepo" (od 29.07.2026 realny pnpm workspace, nie płaskie foldery).

## Kontekst

Budujemy nowy frontend dla IDP jako pierwszy "kafelek" w platformie Cortex. Obecne narzędzie w Streamlit idzie do emerytury. Kolejne kafelki (poza IDP) są zaplanowane — architektura musi to wspierać od dnia zero.

## Struktura — uproszczone monorepo

Cały frontend (wszystkie mikroaplikacje) buduje się naraz z jednego root'a. Bez pnpm workspaces / turborepo na tym etapie — rafinacja później, jak będzie potrzeba.

```
/app/idp/*              → aplikacja IDP (ten prototyp)
/app/[next-tile]/*      → kolejne kafelki Cortex
/libs/@cortex/ui/*      → shared komponenty (Button, Dialog, Stepper, DataTable wrapper)
/libs/@cortex/styles/*  → design tokens, Tailwind config, themes
/libs/@cortex/api/*     → shared API layer (auth, fetch, error handling)
/libs/@cortex/types/*   → shared TypeScript types
/libs/@cortex/utils/*   → shared utilities (formatters, validators)
```

**Decyzja:** na razie tylko struktura folderowa, bez workspace managera.
**Uzasadnienie:** unikamy złożoności setupu na starcie. Gdy projekt dojrzeje i zacznie nas boleć (duplikacja buildów, nieczyste zależności), przejdziemy na pnpm workspaces. Dodanie workspaces później to kilka godzin pracy — przedwczesne robienie tego to ryzyko zamrożenia struktury zanim poznamy realne wymagania.

## Core stack

### Framework: Next.js 15 + React 18 + TypeScript 5.8

**Decyzja:** wszystko jako `"use client"`. Nie używamy RSC (React Server Components) ani teraz, ani w przyszłości.
**Uzasadnienie:** nasz frontend to typowa data-intensive SPA — dashboardy, tabele, formularze, real-time updates. RSC nie daje tu realnej wartości, a dodaje złożoność (dual rendering model, ograniczenia w interaktywności). Next.js traktujemy jako dobry bundler + router + API routes, nie jako serwerowy framework.

### UI primitives: shadcn/ui (Radix + Tailwind)

**Uzasadnienie:** copy-paste komponentów = pełna kontrola, brak lock-in, wygląd 2026 out of the box. Radix daje accessibility. Komponenty lądują w `/libs/@cortex/ui`, reużywalne między kafelkami.
**Alternatywy rozważone:** MUI (za ciężki, styling fight), Ant Design (brzydki enterprise look), Mantine (mniej elastyczny).

### Styling: Tailwind 3.4 + CSS Variables + design tokens z `@cortex/styles`

**Uzasadnienie:** Tailwind daje szybkość, CSS variables pozwalają na theme switching (light/dark) bez rebuilda. Tokens centralne w `@cortex/styles` żeby wszystkie kafelki Cortex wyglądały spójnie.

## Data-intensive layer

### Tables: TanStack Table v8 + `@tanstack/react-virtual`

**Decyzja:** startujemy z TanStack Table. W przyszłości przewidujemy migrację na Handsontable dla ekranów wymagających spreadsheet-like UX (masowa edycja invoice lines, declaration lines).
**Uzasadnienie:** TanStack Table jest headless, darmowy, full control nad renderingiem, pair z TanStack Virtual daje virtualizację dla dużych datasetów. Handsontable będzie miał wartość tam gdzie agent celny chce Excel-like experience — ale to not day-one. Dodanie Handsontable obok TanStack na wybrane ekrany nie wymaga refactoringu.
**Alternatywa odrzucona:** AG Grid (Enterprise za $1000/dev/rok dla master-detail, lock-in).

## State management

### Server state: TanStack Query (React Query)

**Uzasadnienie:** długie pipeline'y AI (import → classify → extract → verify), optimistic updates, invalidation, caching. Bez tego będziemy fetcherami żonglować.

### Client state: Zustand

**Uzasadnienie:** 1KB, prosty, bez boilerplate Redux. Do UI state: sidebar, filters, modals, draft formularzy, selection state.

### Forms: React Hook Form + Zod

**Uzasadnienie:** mamy DZIESIĄTKI formularzy (Invoice, Seller, Buyer, cost allocation) z walidacjami krzyżowymi (waga netto < brutto). RHF + Zod to standard. Schema Zod reużywalne do walidacji API po stronie klienta i serwera.

## Error handling

Pragmatyczna SPA — nie robimy rozbudowanej taksonomii błędów, ale nie akceptujemy też white screen of death.

### Trzy poziomy boundaries

1. **Root boundary** — owija `<AppShell>` (sidebar + header nadal widoczne), fallback: "coś poszło nie tak" + przycisk retry + link do dashboardu. Loguje do konsoli (docelowo: Sentry/OTEL, ale to poza prototypem).
2. **Feature-level boundary** — każdy feature module (`/features/<feature>`) eksportuje swój root component owinięty boundary. Crash w `ClassificationBoard` nie zabija `Dashboard`. Boundary resetuje się na zmianę route'a (`key={pathname}`).
3. **Async/data errors** — obsługiwane przez TanStack Query: `QueryErrorResetBoundary` + lokalne fallbacki w listach/tabelach ("nie udało się pobrać, retry"). Nie propagujemy throw z `useQuery` do feature boundary bez powodu.

### Tooling: `react-error-boundary`

**Uzasadnienie:** mały lib, battle-tested, daje `ErrorBoundary` component + `useErrorBoundary` hook. Nie piszemy własnych klas. Integracja z TanStack Query przez `QueryErrorResetBoundary` — oficjalny pattern.

### Rozdział odpowiedzialności

- **4xx** (validation, not-found, forbidden) → toast (`sonner`) + in-place UI state. Nie throw.
- **5xx / network / thrown JS errors** → boundary (async: feature-level, sync render: root albo feature).
- **Chunk load errors** (split code, deploy w trakcie sesji) → boundary wykrywa `ChunkLoadError`, proponuje refresh strony.

### Co NIE robimy

- Globalnego error interceptora który łapie wszystko. Błędy mają być obsługiwane tam gdzie mają kontekst.
- Retry w nieskończoność. TanStack Query retry domyślnie 3x, dla mutacji 0 — świadomie.
- Ukrywania błędów "żeby user nie widział". Jak coś padło — mówimy.

## Document handling (IDP-specific)

### PDF rendering: `react-pdf` + `pdfjs-dist`

**Uzasadnienie:** battle-tested, obsługuje custom scripts dla Next.js workers.

### Bounding boxes / coordinates highlight: SVG overlay (prototyp) → Konva (produkcja)

**Uzasadnienie:** SVG na `react-pdf` jest prostsze i wystarczające na prototyp (< 50 highlightów naraz). Jeśli dojdziemy do setek highlightów — migracja na `react-konva` (canvas-based).

### Office docs: `docx-preview` (viewer), `xlsx` (parsing)

**Uzasadnienie:** `docx-preview` do wyświetlania w paczce, `xlsx` (SheetJS) do parsowania uploaded Excel files.

## Interaction

### Drag & drop: `@dnd-kit`

**Uzasadnienie:** potrzebne do ekranu klasyfikacji (dokumenty → grupy paczek). `@dnd-kit` nowocześniejszy niż `react-dnd`, lepszy DX.

### Notifications: `sonner`

**Uzasadnienie:** shadcn-native, ładniejsze niż `react-hot-toast`.

### Animations: `framer-motion`

**Uzasadnienie:** stepper transitions, accordion, modal entries. Prototyp obędzie się bez, produkcja tego będzie potrzebować.

### Icons: `lucide-react`

**Uzasadnienie:** największy zestaw, tree-shakeable, semantyka spójna z shadcn.

### Date handling: `date-fns`

**Uzasadnienie:** tree-shakeable, nowocześniejsze niż moment, prostsze niż dayjs.

## Feature flags

Proste, bo na tym etapie nie potrzeba więcej. Ale API musi być takie, żeby swap na dynamiczne źródło (LaunchDarkly / Unleash / własny endpoint) nie wymagał refactoringu call-site'ów.

### Util: `/libs/@cortex/utils/feature-flags/`

```ts
// flags.ts
export type FeatureFlag =
  "idp.classification" | "idp.rules-editor" | "idp.handsontable-tables" | "cortex.dark-mode"

const DEFAULTS: Record<FeatureFlag, boolean> = {
  "idp.classification": true,
  "idp.rules-editor": false,
  "idp.handsontable-tables": false,
  "cortex.dark-mode": true,
}
```

### Trzy źródła (w kolejności priorytetów)

1. **URL override** (dev/QA tylko): `?ff=idp.rules-editor:on,idp.classification:off` — zapisywane do `sessionStorage`, żeby nie trzymać w URL na reload.
2. **Env override** (deploy-time): `NEXT_PUBLIC_FF_IDP_RULES_EDITOR=true`. Przydatne do wypchnięcia flagi per środowisko bez release'u.
3. **Defaults** — hardkodowane w `DEFAULTS`.

Później dojdzie 4. źródło: **remote** (user-based, np. `/api/me/flags`). Dodajemy jako kolejną warstwę w resolverze — call-site'y bez zmian.

### API

```ts
// hook — reaktywny, subskrybuje zmiany źródeł (np. URL override)
const showRulesEditor = useFeatureFlag("idp.rules-editor");

// imperatywnie — dla utils / queries poza komponentami
if (getFeatureFlag("idp.handsontable-tables")) { ... }

// gate component — czytelne warunki w JSX
<FeatureGate flag="idp.rules-editor">
  <RulesEditorButton />
</FeatureGate>

<FeatureGate flag="idp.rules-editor" fallback={<ComingSoonBadge />}>
  <RulesEditorPanel />
</FeatureGate>
```

### Konwencje

- **Namespace**: `<tile>.<feature>` dla flag kafelkowych, `cortex.*` dla platformowych. Unikamy kolizji między kafelkami.
- **Lista flag w jednym miejscu** (`flags.ts`). Dodanie flagi = edycja typu. TypeScript łapie literówki na call-site.
- **Usuwanie flag**: gdy feature stabilny → flaga idzie do kosza razem z gate'ami. Nie zostawiamy martwych gate'ów "na wszelki wypadek".
- **Nie używamy flag do A/B testów**. To nie jest do tego narzędzie. Gdy będzie potrzeba — osobna warstwa.

### Uzasadnienie wyboru (vs. gotowce)

LaunchDarkly/Unleash/GrowthBook na tym etapie to armata na wróble — koszt (pricing lub self-host), complexity, dependency na kolejny system. Własny util to ~100 linii, pokrywa 100% obecnych potrzeb. Adapter pattern pozwala podmienić implementację jedną zmianą gdy realnie będzie boleć.

## Dev / quality tooling

### Component dev: Ladle

**Uzasadnienie:** Storybook jest ciężki, Ladle jest Vite-based, startuje w sekundach, API zgodne z Storybook. Potrzebne żeby rozwijać komponenty w izolacji i dokumentować design system.

### Testing: Vitest + Testing Library + jsdom

Standardowy stack.

### Mocking API: MSW (Mock Service Worker)

**Uzasadnienie:** MSW mockuje na poziomie sieci (fetch intercept), co znaczy że przejście na real API = wyłączenie MSW. Kod aplikacji się nie zmienia.

## Deployment

### Self-hosted: Next.js w Dockerze

**Uzasadnienie:** pełna kontrola, brak dependency na Vercel pricing, integracja z obecną infrastrukturą. Next.js ma official Docker setup w standalone mode.

### Auth: NextAuth

**Uzasadnienie:** ekosystemowy standard dla Next.js, providery out of the box, session management, łatwy upgrade path do SSO gdy będzie potrzebny.

## Folder structure dla `/app/idp/`

```
/app/idp/
├── app/                      → Next.js App Router
│   ├── (auth)/              → routes z auth layout
│   ├── (main)/              → routes z main layout (sidebar)
│   │   ├── dashboard/
│   │   ├── import/
│   │   ├── packages/
│   │   │   └── [id]/        → package detail, verification
│   │   └── classification/  → nowy ekran klasyfikacji
│   ├── api/                 → Next.js API routes (proxy do backend)
│   └── layout.tsx
├── components/              → IDP-specific components (nie reużywalne)
├── features/                → feature modules (classification, verification, import)
│   └── classification/
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── lib/                     → IDP-specific utilities
├── mocks/                   → MSW handlers, mock data
└── types/                   → IDP-specific types
```

Reużywalne idą do `/libs/@cortex/*`, IDP-specific zostaje w `/app/idp/*`.

## Migracja ze Streamlita — podejście

- Nie robimy rewolucji API. Konsumujemy obecny API IDP 1:1, typując odpowiedzi TypeScriptem.
- Ekrany portujemy 1:1 do Next.js z polish wizualnym, zachowując flow i nazewnictwo.
- Nowe funkcje (klasyfikacja, cost allocation) dodajemy jako osobne features.
- Edytor reguł — architektura musi to przewidzieć (nowy feature module), ale NIE implementujemy w prototypie.

## Zakres prototypu

**W prototypie:**

- Setup stack + folder structure dla monorepo
- 4-5 kluczowych ekranów z mock data (Dashboard, Import, Package Queue, Package Detail, Classification NEW)
- Klasyfikacja z DnD, confidence scores, manual override
- Side-by-side PDF viewer z mock bounding boxes
- Spójny design na bazie screenshotów Customate jako inspiracji

**NIE w prototypie:**

- Integracja z realnym backendem
- Auth / permissions
- Error states / edge cases (1-2 happy paths only)
- Edytor reguł cost allocation (tylko szkic ekranu)
- Pełne coverage testów
- Accessibility audit

---

**Request for review:** czy każda z tych decyzji jest akceptowalna z waszej perspektywy? Alternatywy mile widziane — prośba o uwagi w komentarzach, możecie też dzwonić jeśli coś wymaga omówienia.
