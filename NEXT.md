# Next steps — Cortex Frontend

> Resumable handoff. Before anything: `CLAUDE.md` + `architecture_rules.md` + `docs/work/STATUS.md` + this. Wave 18 + Wave 19 mają zbudowany **scaffold MVP end-to-end na MSW** — wizja produktowa niżej, status implementacji w sekcji "Co zrobione", lista następnych kroków pod tym.

## Quick context

Cortex Frontend = Next.js 15 + shadcn/ui port z Streamlita. Wave 1-17 zamknięte (parity, transport orders editor, inline PDF, themes, verification workspace). Wave 18 (Classification) i Wave 19 (Rule Editor) **mają działający scaffold** — clickable end-to-end na danych mockowych (MSW), bez backendu.

## Uruchomienie

```bash
cd /Users/cez/P/new_cortex/cortex_frontend
npm install
npm run msw-init
npm run pdf-assets
npm run dev   # http://localhost:3000 — "Continue as Demo User"
```

`app/idp/.env.local` musi mieć `AUTH_SECRET=<32+ znaków>` i `NEXT_PUBLIC_API_MOCKING=enabled`.

Weryfikacja: `npm run typecheck`, `npm run lint`, `npm run build`. **Wszystko zielone na main.**

---

## Wizja produktowa (decyzje uzgodnione z Cezarym)

**Użytkownik:** agent celny. Robi 20-50 zgłoszeń SAD dziennie. Klient wrzuca worek mieszanych dokumentów (faktury, packing listy, świadectwa, korespondencja, screeny). Dziś robi to ręcznie w Excelu + plikach.

**Hipoteza:** dwa nowe etapy zamieniają godziny dłubaniny w minuty review. LLM gruba robota, człowiek decyduje, audyt zawsze widoczny.

**Decyzje architektoniczne (z 2026-04-21):**
1. **Customer = tag** (nie osobna encja). Atrybut na dirty package / clean package / rule.
2. **Rule DSL = LLM → Python**. Celnik pisze naturalnym językiem ("rozdziel koszt frachtu po wadze netto"), LLM generuje kod Pythona, BE wykonuje w sandbox. Frontend pokazuje NL + wygenerowany Python (read-only debug) + preview na sample.
3. **Plik = atom klasyfikacji** (NIE strona pliku). Drasticznie prostsze UI, strony znaczą gdy klient sam je rozdzieli przed uploadem.

---

## Co zrobione w tej sesji (Wave 18 + 19 MVP scaffold)

### Domain model + types
- `libs/@cortex/types/src/enums.ts` — dodane `DIRTY_PACKAGE_STATUS`, `DOC_TYPE`, `DOC_MODE`, `RULE_STATUS`, `RULE_CATEGORY`, `RULE_TRIGGER`
- `libs/@cortex/types/src/classification.ts` — `DirtyDocument`, `DirtyPackageReadModel`, `DirtyPackageDetailsResponse`, `CleanPackageDraft`, request/response types
- `libs/@cortex/types/src/rules.ts` — `RuleReadModel`, `RuleDetailsResponse`, `RuleVersionReadModel`, `RuleColumnSpec`, `PackageRuleAttachment`, `RuleTemplateReadModel`, request/response types
- Re-eksport w `index.ts`

### MSW fixtures + handlers
- `app/idp/mocks/fixtures/classification.ts` — 12 dirty packages, deterministic random, 9 typów dokumentów (invoice, packing_list, translation_sheet, code_assignment, BOL, cert_of_origin, correspondence, other, skip), customers (Acme, Müller, Sahara, Polontex), drafts auto-routed
- `app/idp/mocks/fixtures/rules.ts` — 6 seed rules (allocate freight, aggregate per CN, currency PLN, derive gross, VLOOKUP CN→PL, split by HS), 6 templates, 4 wersje per reguła, attachment store per package, `compileRuleStub()` (mock LLM keyword routing)
- `app/idp/mocks/handlers.ts` — pełen CRUD: list/get/auto-classify/update-doc/upsert-draft/delete-draft/promote dla classification + list/get/create/update/compile/preview/save-version dla rules + attach/detach/run dla package×rules
- Dodany `apiClient.patch()` w `client.ts` (brakowało, classification używa PATCH)

### API + hooks
- `endpoints.classification.*` i `endpoints.rules.*` w `endpoints.ts`
- Query keys: `queryKeys.classification.*`, `queryKeys.rules.*`, `queryKeys.packages.ruleAttachments(id)`
- Hooks (15 nowych): `useDirtyPackages`, `useDirtyPackage`, `useAutoClassify`, `useUpdateDocumentClassification`, `useUpsertDraft`, `useDeleteDraft`, `usePromoteDirtyPackage`, `useRules`, `useRule`, `useRuleTemplates`, `useCreateRule`, `useUpdateRule`, `useCompileRule`, `usePreviewRule`, `useSaveRuleVersion`, `usePackageRuleAttachments`, `useAttachRule`, `useDetachRule`, `useRunAttachedRule`

### UI — Classification
- `app/idp/app/(main)/classification/page.tsx` — lista dirty packages: search, status filter, badges, navigacja do workspace
- `app/idp/app/classification/[id]/page.tsx` (poza grupą `(main)` żeby ominąć sidebar/topbar — analogicznie do `/verify/[id]`) — workspace 3-kolumnowy z `react-resizable-panels`, Auto-classify button, Promote dialog
- `app/idp/components/classification/document-tree.tsx` — lewa kolumna: lista dokumentów, badges (typ + mode), confidence, target draft pointer
- `app/idp/components/classification/document-preview.tsx` — środek: placeholder preview + edytor klasyfikacji (typ/mode/target/notes/reviewed flag)
- `app/idp/components/classification/draft-list.tsx` — prawa kolumna: lista clean package drafts, dokumenty per draft, "+ New draft"
- `app/idp/components/classification/labels.ts` — wspólne label maps

### UI — Rules
- `app/idp/app/(main)/rules/page.tsx` — lista reguł: search, status/category filters, "New rule" dialog z presetami
- `app/idp/app/(main)/rules/[id]/page.tsx` — editor 2-kolumnowy:
  - Header: name editable, version badge, save metadata, save as v(n+1)
  - Metadata card: category, status, trigger, description
  - Lewa: NL textarea + Compile button + Python (read-only) + new columns + version notes
  - Prawa: sample package picker + "Run dry" + diff table (before/after, changed columns highlighted)
  - Dół: version history z "Load" buttonem (rollback do dowolnej wersji)
- `app/idp/components/rules/package-rules-panel.tsx` — Rules tab w package detail: lista przypisanych reguł, status badges (success/failed/pending), Attach dialog, Run/Detach actions

### Integration points
- Tab "Rules" wpięty w `app/idp/app/(main)/packages/[id]/page.tsx` między "Analysis result" a "Action log"
- Nav (`app/idp/lib/nav.ts`) — Classification i Rules przeniesione z "Coming soon" do main "IDP" sekcji w kolejności: Dashboard → Import → **Classification** → Packages → **Rule editor** → Audit log

### Quality gates
- `npm run typecheck` ✓
- `npm run lint` — czyste w nowych plikach (pre-existing warnings w packages/page.tsx)
- `npm run build` ✓ — wszystkie nowe routes zbudowane

---

## Co dalej — kierunki rozwoju (priorytety)

### P0 — Doszlifować UX classification workspace

Co działa: 3-kol layout, edycja per dokument, drafts, promote. Co brakuje do "wow":
- **Realny preview pliku** (PDF/image render w środkowej kolumnie). Aktualnie placeholder. Potrzeba mock content endpoint dla classification → `GET /classification/.../documents/:id/content`. Backend muszą dostarczyć fizyczne pliki — albo na MVP można dorobić mock blob (sample-invoice.pdf już jest w `/mock-assets/`, można re-use'ować).
- **Drag & drop** dokumentów do drafts (right column). Aktualnie jest dropdown w preview. `@dnd-kit` jest już w deps.
- **Bulk actions** — Shift+click w tree → bulk assign typu/mode/target.
- **Keyboard nav** — J/K po dokumentach, 1-9 przypisanie do package N, S = mark skip.
- **Confidence sort/filter** — pokazuj najpierw te wymagające review (`confidence < 0.8 && !human_reviewed`).

### P0 — Doszlifować Rule editor

Co działa: NL → compile → preview → save z wersjonowaniem. Co brakuje:
- **Diff version-vs-version** — aktualnie history pokazuje listę z "Load" buttonem. Dodać side-by-side diff dwóch wybranych wersji (NL diff + Python diff).
- **Expert mode** — toggle żeby user mógł edytować Python ręcznie (gdy LLM compiled coś dziwnego).
- **Schema introspection** — pickerze sample package powinien wyświetlać dostępne kolumny (po wyborze packageu pokazać listę columns z lines: `cn_code`, `net_weight_kg`, etc.). LLM compile dostaje tę schemę żeby generować poprawne nazwy.
- **Test cases** — możliwość dodania kilku named scenarios ("With missing weight", "With null currency") i odpalania testów na każdej wersji.

### P1 — Templates i auto-attach (customer-driven)

Wynika z decyzji "customer = tag":
- **Customer registry** (po prostu unikalne tagi z wszystkich paczek + reguł). Lista w `/admin/customers` (nowy route) z liczbą paczek per tag.
- **Auto-attach rules per tag** — gdy promote'ujesz dirty package z `customer_tag: "Acme"`, system automatycznie attach'uje wszystkie active rules gdzie `customer_tag === "Acme"` ze swoim domyślnym trigger.
- **Classification template per tag** — "Acme zawsze: 1 invoice + 1 packing + 1 BOL". Po N promote tej samej konfiguracji propozycja "Save as template". Template auto-applied przed user reviewuje.

### P1 — Rule execution audit log

`PackageRuleAttachment` ma `last_executed_at` + `last_status`, ale brak pełnego logu. Dodać:
- **Execution history per attachment** — kiedy odpalona, która wersja, jakie outputy, czas wykonania, błędy
- **Retroactive re-run** — gdy reguła ma v5 a paczka miała v3, button "Upgrade to v5" z preview diff outputów
- **Show which rule generated which column** — w invoice lines grid (`/verify/[id]`) dodaj badge "computed by rule X v3" przy derived columns

### P1 — Connection do verification workspace

Po promote → verification → reguły aplikują się → derived columns powinny być widoczne w `/verify/[id]` lines spreadsheet. Backend musi:
1. Zapisywać outputy reguł jako extra columns w invoice lines (lub osobna tabela `derived_columns`)
2. Zwracać je w response `/packages/:id/transport-orders`

Frontend potem:
- Lines spreadsheet pokazuje dodatkowe kolumny z badge "rule output"
- User może override (lock cell + flag "manual override")

### P2 — Backend RFC

Wszystko zbudowane na MSW. Przed live integracją spisać RFC:
- `docs/rfc/dirty-clean-pipeline.md` — model danych dirty/clean, slicing (skoro plik=atom, raczej referencje plików niż kopie), promote transakcyjność
- `docs/rfc/rule-engine.md` — Python sandbox bezpieczeństwa (timeout, memory limit, allowed imports), schema introspection endpoint, LLM prompt design, koszt cap per workspace

### P3 — Pozostałe (nie ruszamy bez prośby)

- BoundingBoxOverlay (wymaga bbox z BE)
- Feature flags util
- Playwright E2E
- Restore UI (wymaga `include_deleted` filter w BE)
- AppShell consolidation
- Customer entity (nie startujemy bez decyzji produktowej)

---

## Open questions (do decyzji)

1. **Realny preview w classification** — najszybciej re-use `sample-invoice.pdf` z mock-assets dla wszystkich PDF dokumentów w MSW. Akceptowalne na MVP czy chcesz prawdziwą rotację plików?
2. **Drag & drop priorytety** — wpisać teraz czy zostawić dropdown jako "good enough"?
3. **Customer registry** — czy startujemy od razu (bo wszystko czego dotyka, dotyka też tagów) czy później jako P1?
4. **Auto-classify mock** — aktualnie tylko ustawia `confidence = 0.8` na wszystkich. Czy zrobić bardziej realistyczny fake LLM (rozpoznać typ z file_name, bumpnąć confidence per typ)?
5. **Schema introspection** w Rule editor — jakie kolumny realnie są dostępne na wyjściu extraction? Pewnie zbadać `idp-next-prototype/idp_app/src/shared/contracts/transport_orders.py` i wystawić jako MSW endpoint `GET /packages/:id/data-schema`.

---

## Reguły wykonania (przypomnienie)

1. **MSW-first dla Wave 18-19** — backendu nie ma. Stwórz realistic fixtures, kontrakt zdejmie się sam podczas RFC.
2. **Pydantic truth gdy istnieje** — tam gdzie BE jest (packages, transport_orders, audit), czytaj `idp-next-prototype/idp_app/src/shared/contracts/`.
3. **Money/weight/qty stringi** — `formatMoney(value: string)`, NIGDY `Number(v)`. Dotyczy też derived columns z reguł.
4. **Mutations zwracają `{}`** — invalidate przez query keys (`queryKeys.classification.*`, `queryKeys.rules.*`, `queryKeys.packages.ruleAttachments(id)`).
5. **Polling pauza** na `verification_state === "in_progress"` + `ReprocessDialog open`.
6. **Minimal diff, shadcn w `@cortex/ui`, no auto-.md**.
7. **Build check po każdym podzadaniu:** `npm run typecheck && npm run lint && npm run build`.
8. **NIE commituj bez explicit "zrob commita".**

## Git history (ostatnie commity)

```
d34dea3 (feat) Theme skins - dodanie kolorowej "Customs" obok light/dark
17a6f5d (refactor) Simplify Wave 15-17 - fix edit-reset bug, dedupe, extract helpers
75e5906 (feat) Verification workspace - inline spreadsheet + side-by-side PDF
61075f2 (feat) Wave 17.3 restore inline PDF viewer + real Wave 15.8 highlight
786c1d3 (feat) Wave 17.1-17.2-17.4-17.5 polish - structure dialog, ZIP button, diff payload
2e580b1 (feat) Wave 16 parity gaps - filters, polling pause, notes timestamp
646f509 (feat) Wave 15.8 line-to-source cross-linking scaffold
da706b7 (feat) Wave 15 transport orders editor
```

## Gdy resume'ujesz (next session)

1. `cd /Users/cez/P/new_cortex/cortex_frontend && git status` — clean?
2. Przeczytaj sekcję "Wizja produktowa" + "Co zrobione" wyżej.
3. `npm run dev` — przeklikaj:
   - `/classification` → otwórz dowolny → Auto-classify → edytuj → Promote
   - `/rules` → otwórz dowolny (np. rule-0001) → Compile → Preview → Save as new version
   - `/packages/pkg-0002` → tab Rules → Attach + Run
4. Wybierz priorytet z sekcji "Co dalej" — sugeruję **realny preview w classification** + **schema introspection w rules** jako pierwszy round, bo bez tego oba ekrany są tylko ładne, a nie użyteczne.
5. NIE commituj bez explicit "zrob commita".

🖤
