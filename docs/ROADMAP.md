# Roadmapa: Cortex360 jako platforma agentowa (Cortex 2.0)

> Status: przyjęta kierunkowo 12.07.2026 (sesja CD × Atropa). Dokument decyzyjny strategii:
> vault `202605_Cortex-Plus/2026-07-12_status-korekta-CD.md` (+ HTML "Cortex 2.0 - zakład platformowy").
> Ten plik to warstwa inżynierska: co budujemy w tym repo, w jakiej kolejności i po czym poznajemy, że działa.

## Rama

Cortex360 rozwija się z shella modułów w **platformę agentową dla firm 100-1000 FTE**: odpowiednik
Anthropic Cowork dla mid-market, z governance (strefy danych, audit, certyfikacja) i skillami
modelowanymi per klient. Runtime agentowy: **Flue** (`cowork-runner/`, `@flue/runtime`).

Zasada nadrzędna z dokumentu strategii: **nie konkurujemy z Anthropiciem na runtime UX**.
Budujemy to, czego platformodawca nie zrobi: skille klienta, strefy danych P/O/D, pomiar adopcji,
on-prem / model-agnostic. Każda faza ma klienta-poligon - feature bez klienta nie istnieje.

## Taksonomia kafelka (decyzja CD, 12.07.2026)

Każdy kafelek platformy jest jednym z **trzech archetypów**:

| Archetyp | Co obrazuje | Przykład dziś w repo |
| --- | --- | --- |
| **`agent-config`** | Agenta: jego skille, strefę danych, model, harmonogram, historię runów | brak - Faza 1 |
| **`dashboard`** | Dane/artefakty produkowane przez agentów lub systemy | `idp` (dashboard), `okna-czasowe` |
| **`task-chat`** | Konwersację, która tworzy zadania i artefakty | `cortex-cowork` |

Implementacyjnie: pole `archetype` w `Tile` (`app/idp/lib/tiles.ts`) + wspólne kontrakty per
archetyp w `/libs/@cortex/types`. Kategorie functional/department zostają jako drugi wymiar.

## Fazy

Kamienie zgrane z bramkami strategii (G1-G4). Data przy fazie = bramka, nie estymata sprintu.

### Faza 0 - fundament taksonomii i demo G1 (teraz → 31.07)

Cel: "zagra jak Cowork" przestaje być wiarą - staje się wynikiem ślepego testu.

- [ ] Merge `feat/cowork-streaming` → `feat/cortex-tiles` (streaming SSE + agent work trail są
      zbudowane; czekają na wizualny test CD).
- [ ] `Tile.archetype: "agent-config" | "dashboard" | "task-chat"` + oznaczenie istniejących kafelków.
- [ ] **Skille jako dane, nie kod.** Dziś katalog `features/cortex-cowork/skills/*/SKILL.md` jest
      częścią bundle'a. Docelowo: cowork-runner ładuje skille z katalogu wskazanego w configu
      (`skill-frontmatter.ts` już parsuje format) - dodanie skilla u klienta nie wymaga deployu.
      To jest warunek "modelowania skilli per klient" - rdzeń wartości platformy.
- [ ] **Demo pack G1:** 3 skille klasy Climate&Strategy - `status-pack` (transkrypcja → so-what +
      action items), `research-z-cytatami` (web/KB → raport z przypisami), `raport-xlsx` (dane →
      workbook; `excel-report` już jest). Scenariusz testu side-by-side vs Anthropic Cowork,
      ocena ślepa przez nie-deva.

**Bramka G1:** demo side-by-side zdane. Nie zdane do końca sierpnia → fazy 3-4 stop,
warstwa metody (skille + governance) jedzie dalej na stacku Anthropic.

### Faza 1 - archetyp `agent-config` (→ G2, sierpień)

Cel: agent przestaje być hardcodem w `cowork-turn.ts` - staje się konfigurowalnym obiektem.

- [ ] Nowy moduł `/app/agents`: lista agentów + karta agenta.
- [ ] Karta agenta = config: skille (włącz/wyłącz z katalogu), **strefa danych P/O/D**, model,
      limit budżetu (tokeny/zł), tryb uruchomienia (on-demand / harmonogram), system prompt.
- [ ] Persystencja configów: plik JSON/SQLite po stronie cowork-runner (backend-integration
      później, zgodnie z `docs/backend-integration.md` - nie budujemy backendu na zapas).
- [ ] Historia runów per agent: work trail istnieje per wiadomość - podnieść do poziomu agenta
      (lista runów, artefakty, koszt, czas).
- [ ] RBAC minimum na oauth2-proxy claims: kto edytuje config vs kto tylko uruchamia.

### Faza 2 - `task-chat` dojrzewa do zadań (G2 → G3)

Cel: chat tworzy **zadania**, które żyją poza sesją czatu. To odróżnia platformę od "czatu z LLM".

- [ ] Model zadania: `task = { prompt, agent, skille, artefakty, status }`,
      status: `queued → running → review → done`.
- [ ] Background runs: agent pracuje po zamknięciu karty, user wraca do wyniku (SSE już jest,
      brakuje trwałej kolejki w cowork-runner).
- [ ] **Human gate:** zadanie kończy w `review` z podglądem/diffem artefaktów; nic nie wychodzi
      na zewnątrz bez akceptacji człowieka (wzorzec HITL z projektu C&S).
- [ ] Katalog skilli org ("marketplace wewnętrzny"): wersjonowanie, opis, właściciel skilla -
      odpowiednik plugin-marketplace Anthropic, w naszym wydaniu katalogowo-plikowym.

**Bramka G2:** C&S (lub klient równoważny) płaci za wdrożenie z Kit; skille z Fazy 0-2 użyte
u żywego klienta.

### Faza 3 - archetyp `dashboard`: adopcja + governance (→ G3, Q4 2026)

Cel: to, co sprzedaje Kit na zarządzie klienta - widoczność i kontrola, nie feature'y.

- [ ] Kafelek **Adoption dashboard**: runy per user/skill/tydzień, koszt per agent, top skille,
      nieużywane skille. Anty-Shadow-AI - kto realnie używa vs deklaruje.
- [ ] Strefy danych wymuszane technicznie, nie regulaminem: policy sandboxa per strefa
      (deny-read na ścieżki restricted, wzorzec "skrypt lokalnie" - surowe dane przetwarza kod
      w sandboxie, do modelu wchodzą pochodne).
- [ ] Audit log runów (append-only): kto, kiedy, jaki agent, jakie artefakty, jaka strefa.
- [ ] **Gateway modeli:** abstrakcja providera w cowork-runner (Anthropic default; endpoint
      OpenAI-compatible / modele lokalne jako opcja). Argument on-prem/EU - bez tego runtime B
      nie ma racji bytu.

**Bramka G3:** drugi klient dostaje Kit w ≤50% godzin pierwszego wdrożenia (metryka N vs N+1).

### Faza 4 - runtime produkcyjny u klienta (decyzja G4, 1.10.2026)

Wchodzi WYŁĄCZNIE po zdanych G1-G3 i z ownerem nie-founderem. Do tego czasu: nie budować.

- [ ] Instalacja u klienta: docker-compose (Dockerfile jest), seed skilli z Kit, onboarding.
- [ ] Izolacja per klient (single-tenant per instalacja - multi-tenant NIE jest celem;
      on-prem/VPC to nasz wyróżnik, nie SaaS).
- [ ] Backup/restore configów agentów, skilli i audit logu.

## Czego świadomie NIE budujemy

- **Własnego edytora dokumentów / office suite** - artefakty otwiera się w narzędziach klienta.
- **Multi-tenant SaaS** - gramy on-prem/VPC; SaaS to gra Anthropica.
- **Marketplace'u publicznego skilli** - katalog jest per organizacja klienta.
- **Feature'ów bez klienta-poligonu** - każda pozycja wyżej ma nazwisko klienta zanim ruszy kod.
- **Niczego w wieczory foundera po Fazie 0** - warunek budżetu na Fazę 1+: owner nie-founder.

## Metryki platformy (liczone od Fazy 1)

1. Czas dodania nowego skilla u klienta (cel: < 1 dzień, bez deployu).
2. % runów kończących się zaakceptowanym artefaktem (jakość, nie aktywność).
3. Koszt tokenów per zaakceptowany artefakt (spada = flywheel działa).
4. Wynik testu side-by-side vs Cowork, powtarzany po każdej fazie (nie tylko na G1).
