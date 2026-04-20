# Next steps — Cortex Frontend

> Resumable handoff. Before anything: `CLAUDE.md` + `architecture_rules.md` + `docs/work/STATUS.md` + this. Potem tabela parytetu funkcjonalnego w drugiej sekcji — to mapa roboty.

## Quick context

Cortex Frontend = Next.js 15 + shadcn/ui port z Streamlita (`idp-next-prototype/streamlit/src/`). Wszystko `"use client"`, MSW mockuje API 1:1 z Pydantic contracts w `idp-next-prototype/idp_app/src/shared/contracts/`.

**Autorytatywne źródła:**
- Backend API: `idp-next-prototype/idp_app/src/shared/contracts/package_contracts.py` + `package_enums.py` + `api/package/router.py`
- Legacy UI reference: `idp-next-prototype/streamlit/src/pages/` + `components/`

## Uruchomienie

```bash
cd /Users/cez/P/new_cortex/cortex_frontend
npm install
npm run msw-init
npm run pdf-assets
npm run dev   # http://localhost:3000 — "Continue as Demo User"
```

`app/idp/.env.local` musi mieć `AUTH_SECRET=<32+ znaków>` i `NEXT_PUBLIC_API_MOCKING=enabled`.

Weryfikacja: `npm run typecheck`, `npm run lint`, `npm run build`.

---

## Cel sesji: **domknąć feature parity ze Streamlitem**

Porównanie funkcjonalne (nie wizualne) zrobione. Next.js ma ~80% parity — brakuje głównie edytora transport orders (core verification workflow), kilku filtrów i niuansów polling.

### Priorytety (w kolejności wykonania)

**P0 — transport orders editor (core verification UX)**
Bez tego verification flow na prod jest bezużyteczny. API gotowe, brakuje tylko UI.

**P1 — reszta gapów blokujących parity**
Filtry packages list, polling pauza, SAD context, line→PDF nav.

**P2 — polish + inline PDF**
Export structure dialog, download ZIP button, inline PDF viewer (pdfjs downgrade).

---

## P0 — Wave 15: Transport orders editor

**Kontekst:** `streamlit/src/components/transport_orders.py` (1155 linii) renderuje pełny edytor — party × 4, invoice header, lines grid, delivery terms, transport info, SAD context. API endpointy wszystkie gotowe w `@cortex/api` (`useUpdateSeller`, `useUpdateBuyer`, `useUpdateConsignor`, `useUpdateConsignee`, `useUpdateInvoice`, `useUpdateInvoiceLines`, `useUpdateInvoiceTotals`, `useUpdateDeliveryTerms`, `useUpdateTransportInfo`). MSW ma catch-all `POST /packages/:id/transport-orders/*`.

### 15.1 `usePackageTransportOrders` integracja

- Sprawdź `endpoints.packages.transportOrders(id)` — zwraca `PackageTransportOrdersResponse` z `transport_orders` i `verified_transport_orders`.
- W MSW aktualnie zwraca `{ transport_orders: null, verified_transport_orders: null }`. **Musisz rozszerzyć fixture** żeby packages w stanie `ready/completed` miały realistyczny `verified_transport_orders`: array z 1 orderem z `seller`, `buyer`, `consignor`, `consignee`, `transport_info`, `invoices[]` (z `lines[]`, `totals`, `delivery_terms`).
- Źródło shape: `streamlit/src/` + Pydantic `TransportOrder` w backendzie (przeszukaj `idp-next-prototype/idp_app/src/shared/contracts/` dla `TransportOrder`, `Invoice`, `InvoiceLine`, `Party`).

### 15.2 Komponenty party editing (Seller/Buyer/Consignor/Consignee)

Pola (z `transport_orders.py:239-309`):
- `name`, `street`, `postal_code`, `city`, `country_code`, `vat_id`, `eori`, `partner_id`

Jeden generyczny komponent `<PartyEditor>` + 4 użycia. Props: `label`, `value`, `onSave`, `canEdit`. React Hook Form + Zod (deps już w repo).

Read-only gdy `!canEdit`. Save disabled gdy nic się nie zmieniło. Error toast z `toastApiError`.

Lokacja: `app/idp/components/transport-orders/party-editor.tsx`.

### 15.3 Invoice header + delivery terms + totals

Invoice header pola (Streamlit `render_invoice_details`):
- `invoice_number`, `invoice_date`, `currency`, `due_date`, `payment_terms`

Delivery terms: `incoterms`, `place`, `terms_detail`

Totals: `total_net`, `total_tax`, `total_gross`, `currency` (read-only od invoice).

**Money/weight/qty zawsze stringi** (reguła w CLAUDE.md) — `formatMoney(value: string)`.

Każda sekcja = osobna mutacja (`updateInvoice`, `updateDeliveryTerms`, `updateInvoiceTotals`).

### 15.4 Invoice lines grid (**najbardziej złożone**)

Pola per linia (`render_invoice_lines_grid`):
- `line_number`, `po_number` (feature-flagged), `product_code`, `description`, `cn_code`, `hs_code`, `quantity`, `unit_of_measure`, `net_weight_kg`, `gross_weight_kg`, `invoice_value`, `packaging` (nested: `type`, `count`), plus ~5 innych

Streamlit używa `data_editor` (spreadsheet-style). W Next.js najprościej:
- TanStack Table z editable cells (każda komórka = input on click)
- LUB expandable rows z `<Sheet>` per linia

Submit przez `useUpdateInvoiceLines` — body to cała lista linii.

Lokacja: `app/idp/components/transport-orders/invoice-lines-grid.tsx`.

### 15.5 Transport info section

Pola z `UpdateTransportInfoRequest` (sprawdź `@cortex/types/src/transport-orders.ts`): mode, carrier, vehicle, route, etc.

### 15.6 SAD context editor (feature-flagged)

Streamlit (`transport_orders.py:834-1053`) ma expander z 40+ polami w 5 sekcjach: header (7), documents (list), defaults, transport, agent_party (4).

API endpoint: sprawdź w backendzie czy jest `/packages/:id/transport-orders/:oid/sad-context` albo coś podobnego. Jeśli nie — skip (brak backend support).

Feature flag w backendzie: `enable_sad_context` — aktualnie na froncie olewamy feature flags (P3 z poprzedniej sesji). Możesz założyć `true` albo sprawdzić `/user/feature-flags` jeśli endpoint istnieje.

### 15.7 Integracja w Package Details page

Nowy komponent `<TransportOrdersPanel packageId={id} canEdit={canEdit}>` renderowany jako **osobna sekcja** między głównym info card a Tabs (albo jako nowy tab "Transport orders" obok Analysis/Action log/Source materials).

Jeśli `transport_orders.length > 0` → lista accordionów per order, każdy z party × 4, transport info, invoices (z lines grid), SAD (jeśli flag).

Gdy brak transport orders → placeholder "No transport orders extracted yet".

### 15.8 Line → PDF highlight (cross-linking)

Streamlit `_set_line_document_navigation_context()` (`package_details.py:167-197`) — klik wiersza w lines grid ustawia `source_material_related_refs` w session, `SourceMaterialsPanel` czyta to i scrolluje PDF do bbox.

Next.js: Zustand store `useSourceMaterialSelectionStore` z `activePath`, `activePage`, `highlightedRefs`. `InvoiceLinesGrid` setuje store na row click. `SourceMaterialsPanel` czyta store i przekazuje do DocumentViewer.

**Blocker:** inline PDF viewer jest wyłączony (pdfjs bug). Cross-linking zbudować ale faktycznie działający highlight dopiero po przywróceniu PDF viewera (P2).

---

## P1 — Wave 16: Parity gaps

### 16.1 Packages list — brakujące filtry

Obecnie tylko search + processing + verification. Dodaj:

- **Sort by dropdown** — opcje: `created_date`, `file_name`, `processing_state` (per `PACKAGE_SORT_FIELD`). Backend query ma `pattern="^(created_date|file_name|processing_state)$"`, więc tylko te 3. Streamlit reklamuje więcej — to jest limit backendu.
- **Sort order** — asc/desc toggle albo druga ikona obok sort dropdown.
- **Date range** — dwa DatePicker (from/to). Query param: `date_from` + `date_to` ISO. (shadcn nie ma DatePicker — użyj Popover + react-day-picker, albo natywne `<input type="date">` dla speed.)
- **Custom status filter** — dropdown z unique values z packages listy (fetch osobnym query albo derive z `packages.data?.items`). Query param: `custom_status`.

Lokacja: rozbuduj `app/idp/app/(main)/packages/page.tsx`.

### 16.2 Audit log — date range filter

Jw. — `date_from` + `date_to`. Backend `/packages/action_logs` obsługuje.

### 16.3 Polling pauza podczas edycji reprocess AI context

Streamlit pauzuje `run_every` gdy user pisze w additional AI context i package jest w `ready`/`analysis_failed`.

Next.js `usePackage` obecnie pauzuje tylko na `verification_state === "in_progress"`. Dodaj:
- Zustand store `useReprocessDialogStore` z `isOpen: boolean`, `contextBeingEdited: boolean`
- `ReprocessDialog` setuje store na open + gdy `state.enabled && state.text.length > 0`
- `usePackage` hook (albo `packages/[id]/page.tsx`) czyta store i łączy z `effectivePolling`

Lub prostsze: przenieś `reprocessOpen` state do parent → tak już jest → dodaj do `effectivePolling` condition.

```tsx
const effectivePolling =
  pollingEnabled &&
  pkg?.verification_state !== "in_progress" &&
  !reprocessOpen
```

### 16.4 User notes — timestamp "last updated"

Streamlit pokazuje kiedy notes były ostatnio zapisane. Backend nie ma dedykowanego `user_notes_updated_at` w `PackageReadModel`/`PackageDetailsResponse` — **sprawdź Pydantic czy gdzieś jest**. Jeśli nie — wyciągnij z ostatniego `user_notes_updated` action w `actions` query.

Logika: `actions.data?.actions.find(a => a.action_type === "user_notes_updated")?.timestamp` — renderuj w `PackageMetadataEditors` pod textarea.

---

## P2 — Wave 17: Polish + inline PDF

### 17.1 "Show Structure" dialog

Streamlit ma dedykowany button "Show Structure" w Quick Actions który otwiera modal z sformatowaną strukturą JSON (tree view).

Next.js już ma `JsonViewer` w Analysis tab — dodatkowo: Dialog z `<JsonViewer>` otwierany z buttona w Actions card (obok Export). Trivial.

### 17.2 Dedicated "Download ZIP" button

Aktualnie ZIP jest w `ExportMenu` dropdown jako template. Streamlit ma osobny primary button "Download ZIP" (hit direktly `/packages/:id/download`).

Dodaj `<Button>` w Actions card, wywołuje `endpoints.packages.download(id)` + browser download boilerplate z `ExportMenu`.

### 17.3 Inline PDF viewer — przywrócenie

**Aktualny stan:** PDF wyłączony (placeholder z download link) bo `pdfjs-dist@5` + Next.js 15 webpack wali `Object.defineProperty called on non-object`. Próby `transpilePackages` i alias na legacy build nie pomogły.

**Plan ataku (od najbezpieczniejszego):**

1. **Downgrade:** `react-pdf@^8` + `pdfjs-dist@~3.11` (wersje sprzed ESM refactoru). `react-pdf@8` supportuje React 18/19. API Document/Page jest to samo. 90% szans że rozwiąże.

2. Jeśli 1 nie działa — **raw pdfjs legacy**: `import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"` bez react-pdf, własny viewer: `pdfjs.getDocument().promise` → `page.render({canvasContext})`. ~150 linii kodu.

3. Ostateczność: **iframe embed** — object URL w `<iframe>`. Browser renderuje natywnym viewerem. Zero JS deps, zero kontroli (no page nav, no highlight), ale działa.

Po przywróceniu — zintegruj z Wave 15.8 cross-linking (line click → scroll PDF do page + highlight bbox).

Lokacja: `libs/@cortex/ui/src/components/document-viewer.tsx` (przywróć PdfViewer).

### 17.4 File uploader reset w Import

Streamlit bumpuje key FileUploadera po sukcesie żeby wyczyścić widoczną nazwę pliku. Next `ImportPage` resetuje state ale uploader może nadal pokazywać thumb. Jeśli cosmetyczny glitch — dodaj key increment.

### 17.5 Action log payload expansion

`ActionLogTimeline` aktualnie rozwija payload toggleem. Dopracuj: gdy payload to diff (`{ field: { from, to } }`) renderuj jako "X: Y → Z" zamiast raw JSON.

---

## Pozostałe P3 (nie ruszamy dopóki nie poproszę)

- **BoundingBoxOverlay** (wymaga bbox coordinates z backend)
- **Feature flags util** per §11
- **Playwright E2E**
- **Rule editor + Classification** (0 backend endpointów)
- **Restore UI** (wymaga backend `include_deleted` filter)
- **AppShell consolidation** (premature)
- **JsonEditor save wiring** (wymaga nowego backend endpointu lub decompose w Wave 15)

---

## Reguły wykonania (przypomnienie)

1. **Pydantic truth** — gdy dotykasz API/types, czytaj `idp-next-prototype/idp_app/src/shared/contracts/`, nie openapi.json.
2. **Money/weight/qty stringi** — `@cortex/utils/money.ts:formatMoney(value: string)`, NIGDY `Number(v)`.
3. **Mutations zwracają `{}`** — invalidate przez `useInvalidatePackage(id)`.
4. **Polling pauza** na `verification_state === "in_progress"` + po Wave 16.3 na otwartym `ReprocessDialog`.
5. **`emailsMatch` case-insensitive** z `@cortex/utils/email.ts`.
6. **Transitions server-side** — renderuj tylko co zwraca `/transitions`.
7. **Minimal diff, shadcn w `@cortex/ui`, no auto-.md**.
8. **Build check po każdym Wave:** `npm run typecheck && npm run lint && npm run build`.

## Git history (ostatnie commity)

```
8ceb522 (fix) Disable inline PDF viewer, show download placeholder
e82fd73 (fix) Transpile react-pdf and pdfjs-dist  [nieefektywny, zostawiony]
e716f27 (fix) Render BreadcrumbSeparator as sibling of BreadcrumbItem
a30aeb9 (fix) Move ThemeProvider inside ApiProvider
d8710a2 (docs) Update NEXT.md with Wave 10-14 completion + refined P3
5ef7aee (feat) Wave 14: reprocess dialog + shared import options
6f386a4 (feat) Wave 13: additional AI context toggle in Import
ec89190 (feat) Wave 12: user preferences sync, resizable viewer, FileUploader controlled mode
7a97f9c (feat) Wave 11: bulk delete + dedupe Dashboard/Packages columns
2e76cbd (feat) Wave 10: custom status + notes edit, export menu, dashboard overflow fix
b476a2a (docs) Add Ladle stories for core UI and domain components
ebf73e0 (feat) Wave 7-9: align with Python backend, viewers, dark mode, error boundaries
```

## Gdy resume'ujesz (next session)

1. `cd /Users/cez/P/new_cortex/cortex_frontend && git status` — clean?
2. `cat docs/work/STATUS.md` + ta sekcja wyżej ("Cel sesji")
3. `npm run dev` — sanity check że strona się otwiera + packages/pkg-0031 działa + Source materials otwiera (PDF jako placeholder, DOCX/XLSX inline)
4. Zacznij od **P0 Wave 15.1** — rozszerz MSW fixture dla transport orders (bez tego reszta Wave 15 jest ślepa)
5. NIE commituj bez explicit "zrob commita"

🖤
