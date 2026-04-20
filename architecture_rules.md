# Architecture Rules — Cortex Frontend

> **Do not modify this file unless explicitly requested by user.**

Reguły i konwencje dla całego repo Cortex Frontend (monorepo: `/app/*`, `/libs/@cortex/*`). Tam gdzie istnieje dedykowany skill — **nie duplikujemy wiedzy, odsyłamy**. Skille są zainstalowane globalnie i uruchamiane przez Claude'a kontekstowo.

---

## 1. General principles

- KISS, DRY. Apply minimal diff.
- Strict TypeScript — no `any`, no `as unknown as T` bez uzasadnienia. Unions/discriminated unions zamiast `any`.
- Self-documenting code. Komentarz tylko gdy WHY jest nieoczywisty.
- Reuse before adding. Nie dodajemy nowej zależności, jeśli coś równoważnego już jest w repo.
- NEVER auto-create `.md` files.

---

## 2. Next.js / React

Rely on: **`vercel:nextjs`** (App Router, layouts, routing), **`vercel:react-best-practices`** (TSX checklist).

**Project-specific overrides** (nadpisują defaulty ze skillów):

- **Wszystkie komponenty jako `"use client"`.** Nie używamy RSC — ani teraz, ani w przyszłości. Powód: data-intensive SPA, RSC nie dodaje wartości, podwaja model renderu.
- W konsekwencji: **nie używamy** `vercel:next-cache-components`, `cacheLife`, `cacheTag`, `updateTag`, ani innych cache primitives RSC.
- Server Actions — **nie**. Dane idą przez TanStack Query + API routes (proxy do backendu IDP).
- API routes (`app/api/*`) tylko jako thin proxy / BFF. Żadnej logiki biznesowej.
- Bundler: Turbopack. Gdy problem — zajrzeć do **`vercel:turbopack`**.

**Rendering strategy:** client-only. Brak SSR content dla authenticated ekranów. Static rendering tylko dla public marketing pages (jeśli kiedyś dojdą).

---

## 3. UI components

Rely on: **`vercel:shadcn`** (CLI, composition, theming), **`frontend-design:frontend-design`** (distinctive UI, anti-generic-AI-look).

**Project-specific:**

- Komponenty shadcn instalujemy do `/libs/@cortex/ui/components/*`. Nigdy bezpośrednio do `/app/<tile>/`.
- Kompozycje (np. `<DataTable>`, `<Stepper>`, `<DocumentViewer>`) — też w `/libs/@cortex/ui/` jeżeli używane przez >1 kafelek.
- App-specific komponenty (np. `<InvoiceHeaderForm>` dla IDP) — w `/app/idp/components/` lub `/app/idp/features/<feature>/components/`.
- **Nie rozbijamy przedwcześnie.** Trzy podobne linie ≠ abstrakcja. Komponent wydzielamy przy 3. użyciu albo gdy logika wewnątrz zaczyna się rozjeżdżać.

---

## 4. Styling & theming

- Tailwind 3.4, CSS variables dla tematów.
- Tokeny (kolory, spacing, radius, shadows) centralnie w `/libs/@cortex/styles/tokens.css`. Tailwind config czyta z CSS vars.
- Light/dark switch bez rebuilda (przez `.dark` class + CSS vars).
- **Nie używamy** inline style ani CSS-in-JS. Tailwind classes + `cn()` helper (z `clsx` + `tailwind-merge`).
- Klasy porządkujemy przez `prettier-plugin-tailwindcss`.

---

## 5. State management

### Server state — TanStack Query

- Jeden `QueryClient` per app root. Devtools włączone tylko w dev.
- **Query keys** jako hierarchiczne tuple: `["packages"]`, `["packages", id]`, `["packages", id, "actions"]`. Keys definiowane w `app/idp/features/<feature>/queries.ts` — jedno miejsce na listę, brak magic strings.
- Mutations zawsze z `onSettled` invalidation. Optimistic updates tam gdzie user-perceived latency ma znaczenie (verification flow).
- Polling — tylko z `refetchInterval` + `enabled`. Nie używamy `setInterval` ręcznie.

### Client state — Zustand

- Jeden store per domena UI (`useSidebarStore`, `useFiltersStore`). Bez god-store'a.
- Selektory zwracają prymitywy/stable refs, żeby uniknąć re-renderów.
- Persist (localStorage) tylko świadomie, dla rzeczy typu "ostatnio użyte filtry", nie dla sesji.

### Forms — React Hook Form + Zod

- Schema Zod jako single source of truth. Typ formularza = `z.infer<typeof schema>`.
- Walidacje krzyżowe przez `.superRefine()` (np. `netto < brutto`).
- Komponenty pól: `<Field name="..." />` wrapper integrujący RHF + shadcn inputy. Nie powielamy `register()` boilerplate.

---

## 6. Tables & virtualization

- TanStack Table v8 + `@tanstack/react-virtual` dla list > 200 wierszy.
- Kolumny definiujemy w `columns.ts` obok komponentu tabeli — czysta dataowa definicja, bez JSX (JSX tylko w `cell`).
- Gdy ekran wymaga Excel-like UX (bulk edit invoice lines) — rozważamy Handsontable **obok** TanStack, nie zamiast. Nie refactorujemy działających tabel.

---

## 7. Document handling (IDP)

- PDF: `react-pdf` + `pdfjs-dist`. Worker config przez `scripts/copy-pdf-assets.mjs` (pattern z IDP prototype — replikujemy).
- Bounding boxes: SVG overlay (prototyp). Jeżeli scale > ~50 jednoczesnych highlightów — migracja na `react-konva`.
- DOCX: `docx-preview`. XLSX parsing: `xlsx` (SheetJS).
- Wszystkie viewery — lazy loaded (`dynamic(() => import(...), { ssr: false })`). Ciężkie zależności nie lądują w initial bundle.

---

## 8. API layer

- Shared fetch/auth/error handling w `/libs/@cortex/api/`.
- Jeden `apiClient` z baseURL + auth interceptor (cookie/header passthrough).
- Błędy mapujemy na `ErrorCode` enum z backendu (shared types w `/libs/@cortex/types/`).
- Toasty dla 4xx (via `sonner`). 5xx → error boundary + retry option.
- Podczas prototypu **MSW** mockuje na poziomie network. Przełączenie na real API = wyłączenie MSW w `layout.tsx`, zero zmian w kodzie feature'ów.
- Middleware / proxy — zajrzeć do **`vercel:routing-middleware`**.

---

## 9. Error handling

Pragmatyczna SPA — minimum ceremonii, zero white screen of death.

- **Jedna implementacja:** `react-error-boundary`. Nie piszemy własnych klas `componentDidCatch`.
- **Root boundary** w root layout kafelka (`/app/<tile>/app/layout.tsx`) — fallback renderuje app shell (sidebar/header nadal widoczne) + retry + link do dashboardu.
- **Feature-level boundary:** każdy feature module eksportuje swój root component owinięty `<ErrorBoundary>`. Reset przez `resetKeys={[pathname]}` — zmiana route'a czyści stan błędu.
- **Async/data errors** przez TanStack Query: `QueryErrorResetBoundary` na poziomie feature. Lokalne fallbacki w tabelach/listach ("nie udało się pobrać, retry"). Nie propagujemy throw z `useQuery` w górę bez powodu.
- **Retry policy:** query domyślne (3x, exponential), mutacje 0. Nadpisujemy świadomie per hook, nie globalnie.
- **Podział:**
  - `4xx` (validation/not-found/forbidden) → toast (`sonner`) + in-place UI. Nie throw.
  - `5xx` / network / synchronous JS errors → boundary (feature albo root).
  - `ChunkLoadError` (deploy w trakcie sesji) → boundary wykrywa po nazwie, proponuje full page refresh.
- **Żadnego globalnego error interceptora** który łapie wszystko — błędy mają być obsługiwane tam gdzie mają kontekst.
- **Nie ukrywamy błędów.** Jak coś padło, user to widzi. Silent fallback = bug.
- Logging do Sentry/OTEL — poza scope'em prototypu, ale boundary fallback ma przyjmować `onError` callback, żeby integracja była jednolinijkowa.

---

## 10. Feature modules

Struktura każdego feature'u (`/app/<tile>/features/<feature>/`):

```
<feature>/
├── components/    → JSX, UI tego feature'u
├── hooks/         → use<Feature>*.ts (custom hooks, TanStack Query hooki)
├── queries.ts     → query keys + fetchers
├── schemas.ts     → Zod schemas
├── types.ts       → TS types (co nie jest w /libs/@cortex/types)
└── index.ts       → public API feature'u (named exports)
```

- Feature A nie importuje z internals feature'u B. Tylko przez public `index.ts`, i tylko gdy naprawdę potrzeba.
- Cross-feature shared stuff → `/libs/@cortex/*`.

---

## 11. Feature flags

Minimalny własny util, żeby nie wciągać LaunchDarkly na prototyp. API zaprojektowane tak, żeby swap na remote source był non-event.

- **Lokalizacja:** `/libs/@cortex/utils/feature-flags/`. Nigdy inline w kafelkach, nigdy luźne stringi.
- **Rejestr flag** w `flags.ts` — typ `FeatureFlag` jako dyskryminowany literal union. Nowa flaga = nowy literal + wpis w `DEFAULTS`. TypeScript łapie literówki na call-site.
- **Nazewnictwo:** `<tile>.<feature>` dla flag kafelkowych (`idp.rules-editor`), `cortex.<area>` dla platformowych (`cortex.dark-mode`). Kropka jako namespace separator, kebab-case w `<feature>`.
- **API:**
  - `useFeatureFlag(flag)` — hook reaktywny, w komponentach.
  - `getFeatureFlag(flag)` — imperatywnie, poza komponentami (queries, utils, middleware).
  - `<FeatureGate flag="..." fallback={...}>...</FeatureGate>` — czytelne warunki w JSX.
- **Źródła (priorytet malejąco):**
  1. URL override (dev/QA): `?ff=idp.rules-editor:on,idp.classification:off` → `sessionStorage`.
  2. Env: `NEXT_PUBLIC_FF_IDP_RULES_EDITOR=true`.
  3. Defaults z `DEFAULTS`.
  4. (Przyszłość) Remote `/api/me/flags` — dołoży się jako kolejna warstwa w resolverze, call-site bez zmian.
- **Usuwanie flag** jest obowiązkowe. Feature stabilny → flaga + wszystkie gate'y lecą. ESLint rule / grep review na dead flags przy PR.
- **NIE do A/B testów.** To nie narzędzie do eksperymentów — gdy będzie potrzeba, osobna warstwa.
- **NIE do business logic long-term toggles.** Flaga = tymczasowa. Decyzja biznesowa "funkcja tylko dla planu enterprise" to uprawnienia/role, nie flaga.

---

## 12. Testing

Rely on: **`webapp-testing`** (Playwright + local verification).

- **Unit/component:** Vitest + Testing Library + jsdom. Testujemy zachowanie, nie implementację. Brak snapshot tests poza trywialnymi przypadkami.
- **Integration:** feature na MSW (prawdziwe fetche, mockowany network).
- **E2E:** Playwright na live dev serverze. Uruchamiane lokalnie + w CI (manual trigger na start).
- **Component dev:** Ladle. Każdy komponent w `/libs/@cortex/ui/` ma `.stories.tsx`.
- Testy edge cases, nie happy path tylko. Happy path łapie browser click-through.

---

## 13. Naming

### Files
- `kebab-case` dla wszystkiego (`package-details-page.tsx`, `use-polling-resource.ts`).
- Komponenty w pliku: 1 komponent = 1 plik, nazwa pliku = nazwa komponentu.
- Test files: `<name>.test.ts(x)`. Stories: `<name>.stories.tsx`.

### Symbols
- Komponenty: `PascalCase` (`PackagesTable`, `DocumentViewer`).
- Hooki: `useCamelCase` (`usePackage`, `usePollingResource`).
- Types/Interfaces: `PascalCase`, bez `I` prefiksu (`Package`, `PackageStatus`). Interface tylko gdy potrzebne `implements` lub `extends` — inaczej `type`.
- Zustand stores: `useXxxStore` (`useSidebarStore`).
- Query keys: `lowercase` strings w tuple, jak w sekcji 5.
- Event handlers: `handleXxx` w komponencie, `onXxx` w propsach.
- Boolean props/vars: `is/has/should/can` prefix.

### Imports
- Ścieżki przez aliasy (`@cortex/ui/*`, `@/features/*`). Nie `../../../`.
- Kolejność: zewnętrzne → `@cortex/*` → `@/*` → relative. `prettier-plugin-organize-imports` pilnuje.

---

## 14. Code style

- Formatter: Prettier. Linter: ESLint (strict + react/hooks plugin + tailwindcss plugin).
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Line length: 100.
- Double quotes dla stringów, trailing commas zachowane.
- Żadnych `console.log` w mergowanym kodzie (ESLint rule).

---

## 15. Performance

Rely on: **`vercel:react-best-practices`** (memoization checklist, render optimization).

**Project-specific red flags:**
- Re-render całej tabeli na każdy keystroke w filtrze → debounce (300ms) + memo.
- `useEffect` z fetchem → zastąpić TanStack Query.
- Ciężki komponent w initial bundle → `dynamic()` import z `ssr: false`.

Nie memoizujemy przedwcześnie. `React.memo` / `useMemo` / `useCallback` — tylko gdy profiler pokazuje problem.

---

## 16. Accessibility

- Radix (via shadcn) daje a11y out-of-the-box. Nie rozbrajamy (nie nadpisujemy `aria-*` bez powodu).
- Keyboard navigation dla wszystkich interakcji (tab order, ESC na modalach, Enter na submit).
- Focus visible — nie wyłączamy outline globalnie, używamy `focus-visible:` w Tailwind.
- Accessibility audit to nie prototype scope, ale nie generujemy długu — jeżeli shadcn daje a11y, używamy tak jak jest.

---

## 17. Review & quality workflow

- Przed PR — invoke **`simplify`** na zmienionym kodzie (reuse check, quality check).
- PR review — **`pr-review-toolkit:review-pr`**.
- Gdy piszemy decision doc / RFC (jak `docs/frontend-architecture.md`) — **`doc-coauthoring`**.
- Gdy projektujemy nowy komponent/ekran od zera — **`frontend-design:frontend-design`** (anti-generic-AI-look).

---

## 18. Deployment

- Next.js standalone output (`output: "standalone"` w `next.config.ts`) → Docker image.
- Auth przez NextAuth. Session w cookie, JWT strategy na start. SSO gdy enterprise klient tego zażąda.
- Self-hosted. **Nie** używamy `vercel:deployments-cicd`, `vercel:vercel-functions`, `vercel:vercel-storage`, `vercel:runtime-cache`, `vercel:marketplace`. Tych skilli nie wołamy — nie dotyczą naszego deploymentu.

---

## 19. Co NIE robimy

- ❌ Server Components / Server Actions
- ❌ Vercel-specific primitives (deploy, functions, storage, cache, marketplace)
- ❌ RSC cache API (`cacheLife`, `cacheTag`)
- ❌ Inline styles, CSS-in-JS
- ❌ Redux, MobX, Recoil (mamy Zustand + TanStack Query)
- ❌ Moment.js, Lodash (mamy `date-fns` + native)
- ❌ Axios (mamy `fetch` przez `@cortex/api`)
- ❌ `any`, ręczny casting bez `satisfies`
- ❌ Własne klasy error boundary (`react-error-boundary` jest jedyną implementacją)
- ❌ LaunchDarkly / Unleash / GrowthBook (mamy własny util w `@cortex/utils/feature-flags`)
- ❌ Globalny error interceptor łapiący wszystko (błędy obsługiwane w kontekście)
- ❌ Feature flags do A/B testów i long-term business logic toggles
