# Streamlit IDP — UX Map for Next.js Rewrite

Source: `/Users/cez/P/new_cortex/idp-next-prototype/streamlit/` (frontend.md + src/pages/*.py).
Auth: proxy header `X-Auth-Request-Email`. Cookies forwarded to API. Logout goes to `/logout`.
Layout: collapsible left sidebar (logo, nav buttons, user email w/ Logout, document split preference dropdown on details page). Content centered with margins.

## 1. Screen inventory

| Screen | Route / page key | Purpose | Key data shown | Primary actions |
|---|---|---|---|---|
| Dashboard | `?page=dashboard` | Landing: recent uploads + status KPIs | 5 metric tiles (In Queue+Processing, Ready for Verification, In Verification, Verified, Failed); table of last 5 packages (file name, created date, status) | Click Details (row action), navigate via sidebar |
| Packages | `?page=packages` | Browse/manage all packages | Filtered+paginated package table; selection checkboxes | Filter, sort, search, paginate, bulk Delete, open Details, Import (via sidebar) |
| Import | `?page=import` | Upload ZIP or loose files | Two upload sections: "Import ZIP Package" + "Import Files" (multi-file → zipped client-side) | Upload, toggle Fast model, toggle Additional AI context + free text, Import |
| Package Details | `?page=package_details&package_id=<id>` | Inspect, verify, export one package | Header w/ filename; processing state badge; verification state badge; assignee; imported date; size; tokens/cost; optional custom status; user notes; transport orders (editable in verification); action log; optional document preview panel | Reprocess (w/ fast + ai context toggles), Download ZIP, Show Structure (JSON tree modal), Export (dropdown template + validate), Start/Finish/Cancel/Reset Verification, edit structured fields, Save Note, set Custom Status, Back |
| Audit Log | `?page=audit_log` | Global action history across packages | Paginated action log grid | Filter (action type, performed by, date range), Refresh, paginate |

## 2. User flows

### 2.1 Import flow (ZIP or loose files)
1. Sidebar → Import page.
2. Pick path: (a) single ZIP via file uploader, OR (b) multi-file uploader — frontend zips client-side before POST.
3. Optional: tick "Fast processing" (cheaper Gemini model).
4. Optional (feature-flagged `enable_additional_ai_context`): tick "Additional AI context" → free-text instructions. Validation: text required if box ticked.
5. Click Import → spinner → POST to API. On success: toast, reset uploader (bumped key), reset packages list state, rerun.
6. On `ApiError`: inline `st.error` with `e.detail` under the section.

### 2.2 Verification flow
1. From Packages or Dashboard, open Details.
2. Package must be in state allowing `START_VERIFICATION` transition (derived from `/transitions` endpoint).
3. Click Start Verification → assignee is set to current user.
4. Only assignee whose email matches `X-Auth-Request-Email` can edit fields (`can_edit`). Others see read-only forms.
5. Transport Orders panel becomes editable: parties (seller/buyer/consignor/consignee), transport info, SAD context (flagged), invoice header, delivery terms, totals, lines. Each has its own Save handler → dedicated endpoint → toast.
6. Auto-refresh is DISABLED while `verification_state == IN_PROGRESS` (prevents clobbering in-flight edits).
7. Click Finish Verification (primary button) → promotes `verified_result`. Cancel/Reset available as secondary transitions.
8. Post-verification: Download Result / Export templates become authoritative from `verified_result`.

### 2.3 Audit review flow
1. Sidebar → Audit log.
2. Optional filters: Action Type (enum dropdown), Performed By (text), From/To Date.
3. Any filter change resets pagination to page 0.
4. Click Refresh to force reload.
5. Paginate via Previous/Next. Page footer: "Page X of Y (total logs)".
6. Each row shows action type, package, actor, timestamp, collapsible payload.

### 2.4 Package detail navigation
1. Enter via Dashboard or Packages (table row Details button → sets `selected_package_id` + `?package_id=` query param → `st.switch_page`).
2. URL is deep-linkable — reloading retains selection via `st.query_params`.
3. "Back to Packages" clears selection and any `json_edit_value` draft, then switches page.
4. Details page polls every `refresh_interval` (default 5s) via `@st.fragment(run_every=...)` — EXCEPT when in verification mode or when editing reprocess AI-context in READY/ANALYSIS_FAILED (poll disabled to preserve user input).
5. On processing/verification state change between polls, triggers `st.rerun()` to recompute refresh policy.

### 2.5 Bulk delete flow
1. Packages page → tick rows in dataframe → "Delete" button appears below table.
2. Click → modal dialog ("Confirm Deletion") with warning + irreversible caption.
3. Cancel closes modal. Delete triggers batch API call.
4. On success: clear selection, stash toast message in session state, rerun → toast "Deleted N package(s)" on next render.
5. On `ApiError`: inline error in dialog.

## 3. Per-screen UX notes

### Dashboard
- Wrapped in `st.fragment(run_every=5s)` → both stats and recent list auto-refresh.
- 5 equal metric columns (`st.metric`) above list.
- Recent packages use shared `render_packages_dataframe` + hidden buttons trick (Streamlit-only; Next.js can use direct row action button).
- Empty state: `st.info("No packages available")`.
- Errors surface as `st.error` with `e.detail` (ApiError) or `type: msg`.

### Packages
- Filters row: Processing State (enum dropdown w/ "All"), Search (text), Sort By, Sort Order, From Date, To Date, (optional) Custom Status (when `package_custom_statuses` flag on).
- Filter changes: compared as a block; if any differ → persist to session state + `reset_packages_state()` (zeros pagination).
- Pagination: Previous/Next buttons with `Page X of Y (N packages)` caption. Hidden when 1 page.
- Selection → bulk Delete button (1/4 of width) appears below table.
- Auto-refresh: 5s fragment. Date objects recomputed inside fragment to pick up live filter changes.
- Success/error toasts pulled from session state slots (`packages_delete_toast`) to survive rerun.

### Import
- Two independent sections ("Import ZIP Package" and "Import Files"), each with own Fast-model checkbox, optional Additional-AI-context checkbox+textbox, Import button.
- Uploader reset uses an incrementing key suffix (`import_zip_uploader_<n>`) to visually clear after submit.
- Additional AI context reset is "queued" and applied on next render (Streamlit widget state limitation — Next.js can reset immediately).
- Validations: files required; if ctx box ticked, non-empty text required.
- Spinner during upload; toast on success.

### Package Details
- Top: Back button → Packages.
- Title: `details.file_name`.
- Quick Actions row (3 cols): Reprocess (+ fast + ai-context sub-controls), Download ZIP, Show Structure (opens modal dialog with JSON tree, 640px high, scrolling HTML). Reprocess is only enabled when transition available.
- Export section: selectbox of export templates (from API: display_name, name, format) + Export button. Flow: validate → if warnings, modal dialog shows severity-colored list; errors block; user can "Export Anyway" if only warnings. Download triggered via injected JS (`_trigger_download_js`) on next render.
- Info cards (2 cols): left = processing state badge + imported date + optional custom status dropdown (saves on change, toast). Right = size in MB + optional tokens + cost.
- User Notes card (flagged): textarea + Save button, shows "Last updated" timestamp from action log. Session keyed per package.
- Verification card (flagged): verification badge, assignee, 4 action buttons (Start / Finish / Cancel / Reset) — each enabled only if transition present. Finish is primary when in verification mode.
- Transport Orders section: renders `TransportOrder` list from `verified_transport_orders` if present, else `transport_orders`. Edit handlers per field group (seller, buyer, consignor, consignee, transport info, SAD, invoice, delivery terms, totals, lines). When editing + `enable_document_preview` flag on → 2-column layout (editor | sticky source-materials preview panel) with user-preference-persisted ratio (0.3/0.4/0.5/0.6/0.7 — selectbox in sidebar, saved via `set_user_preferences`).
- Source materials panel: shows PDF/image preview with navigation and highlights keyed off selected invoice line's `source_references`. Navigation state stored per-package in session.
- Action Log section: full log, no pagination, collapsible payload per row (JSON).
- Auto-refresh: 5s fragment; disabled during verification or reprocess-context editing to avoid stomping user input.

### Audit Log
- Filters in a 4-column row; any change calls `reset_audit_log_state()` (page 0).
- Refresh button top-left.
- Global action log dataframe (no auto-refresh; manual Refresh).
- Pagination footer identical to Packages.

## 4. Session state that persists

**Navigation / selection**
- `current_page` (also mirrored in `?page=`)
- `selected_package_id` (also `?package_id=`)
- `pages` (page registry — Streamlit-specific, N/A for Next.js)

**Packages filters/pagination**
- `packages_processing_filter`, `packages_search`, `packages_sort_by`, `packages_sort_order`, `packages_date_from`, `packages_date_to`, `packages_custom_status_filter`, `packages_page`
- `selected_packages_<key>` (row selections)

**Audit filters/pagination**
- `audit_log_action_type_filter`, `audit_log_performed_by`, `audit_log_date_from`, `audit_log_date_to`, `audit_log_page`

**Package detail drafts & per-package cache**
- `package_<id>_verification_state`, `package_<id>_processing_state` (used to decide whether to disable auto-refresh)
- `user_notes_<id>` (textarea draft before Save)
- `reprocess_fast_<id>`, `reprocess_additional_ai_context_enabled_<id>`, `reprocess_additional_ai_context_<id>`
- `source_material_*_<id>` (related refs, line label, navigation path/page/highlights/token/counter)

**Import transient**
- `import_zip_uploader_key`, `import_files_uploader_key` (bumped to reset uploaders)
- `import_zip_additional_ai_context_enabled`, `import_zip_additional_ai_context`, same for `import_files_*`
- `import_success`, `import_files_success`, `import_error`, `import_files_error`
- `*_additional_ai_context_reset_pending` (deferred reset flags)

**User preference (server-side via API)**
- `document_panel_ratio` (editor vs preview split, 0.3–0.7) — persisted via `set_user_preferences`.

**One-shot toasts** (pattern: set key, rerun, pop on next render)
- `packages_delete_toast`, `status_saved`, `notes_saved`, `_export_pending` (content, filename, mime)

## 5. Edge cases worth preserving

- **HTTP 400 / ApiError**: `e.detail` message rendered via `st.error` inline at the section; on verification save actions it's a toast-ish inline error under the form. Frontend spec: toast keyed off `ErrorCode` from API.
- **Missing package_id on details**: show "No package selected" + "Go to Packages" button (instead of crashing).
- **Deep link to details**: `?page=package_details&package_id=<id>` must restore selection before first render.
- **Empty package list**: `st.info("No packages available")` on Dashboard; Packages page simply renders empty table + pagination showing page 1 of 1.
- **Loading**: `st.spinner` wraps every list/detail fetch (`"Loading packages..."`, `"Loading audit logs..."`, `"Importing package..."`, `"Validating..."`).
- **Export warnings dialog**: shows red "Error:" lines (block) and orange "Warning:" lines (allow). Export Anyway disabled when any error severity present.
- **Verification authorization**: only assignee whose email matches `X-Auth-Request-Email` (case-insensitive) sees editable forms. Others see read-only in same layout.
- **Auto-refresh suppression**: critical — never poll over user input during verification or reprocess-context editing. Refresh policy changes trigger explicit rerun so the next fragment cycle picks up the new `run_every`.
- **Uploader reset**: bump-the-key pattern after successful import; in Next.js use controlled component + reset state directly.
- **User preference load**: on first render of details, `_DOCUMENT_PANEL_PREFERENCES_LOADED_KEY` gate prevents re-fetching preferences; failure falls back to default 4/9 ratio silently.
- **`verified_result` vs `analysis_result`**: Show Structure prefers verified when present (with source label); exports validate/export against current truth.
- **Custom status "(none)"**: treat as null; comparing to `details.custom_status` determines whether to PATCH.
- **ZIP vs loose files**: loose files must be client-zipped before upload (API accepts ZIP only).
- **Logout**: clicking redirects to `/logout`; proxy handles actual session termination.
