# Uruchomienie lokalne

Cel: jedna komenda, zero ręcznej konfiguracji Postgresa, przeglądarka na
`http://localhost:3000` pokazuje działający, zalogowany hub z dostępem
administratora. Nie architektura — po decyzje/uzasadnienia patrz
`docs/infrastructure.md`.

## Wymagania

Tylko Docker (z Docker Compose v2 — `docker compose`, nie `docker-compose`).
Żadnego lokalnego node/pnpm, żadnej ręcznie stawianej bazy.

## Start

```bash
docker compose up
```

To wszystko. `docker-compose.yml` w korzeniu repo buduje obraz lokalnie i
stawia: `postgres`, krok `migrate` (migracje + wszystkie seedy, kończy się i
gasi), `cortex-frontend`, oraz mikroserwisy Pythona, których kafelki
faktycznie potrzebują (`geo-score-calculator`, `document-parser-backend` +
`document-parser-unoserver`). `cortex-frontend` startuje dopiero po
powodzeniu `migrate` (`service_completed_successfully`) — świeża, pusta baza
nigdy nie zostaje zaserwowana.

Pierwsze uruchomienie buduje obraz od zera (kilka minut). Kolejne `docker
compose up` używają cache'a warstw i startują w kilkanaście sekund.

## Dostęp

Otwórz `http://localhost:3000`.

Bez żadnej zmiennej env jesteś zalogowany jako **`dev@cortex.local`** —
pełny administrator (rola `admin`, grant do wszystkich zarejestrowanych
aplikacji). Mechanizm: `docker-compose.yml` domyślnie ustawia zarówno
`ADMIN_EMAIL`, jak i `DEV_USER_EMAIL` na `dev@cortex.local` — pierwsza
zmienna każe krokowi `migrate` założyć to konto z rolą admin, druga każe
appce traktować Cię jako to konto, gdy nie ma nagłówka `x-auth-request-email`
(realne, produkcyjne uwierzytelnienie przez oauth2-proxy — poza zakresem tego
compose, patrz nagłówek pliku `docker-compose.yml`). Jeśli chcesz się widzieć
pod własnym adresem, ustaw `ADMIN_EMAIL=ty@twojadomena.pl` w `.env` obok
`docker-compose.yml` — `DEV_USER_EMAIL` podąży za nią automatycznie, o ile
sam jej nie nadpiszesz.

### Cztery kafelki z tej sesji

**Kreator treści (Content Guru)** jest aktywny od razu.

**Kalkulator GEO Score**, **Parser Dokumentów** i **Visual Guru** rejestrują
się w bazie jako kandydaci, ale ZOSTAJĄ nieaktywne do jednorazowej ręcznej
aktywacji — to świadomy mechanizm rejestru kafelków (`docs/tile-registry.md`),
nie luka tego compose. Jako zalogowany administrator:

1. Wejdź w **Konfiguracja Systemu → Aplikacje**.
2. Przy każdym z trzech kafelków kliknij **„Dodaj aplikację"**.

Po aktywacji kafelek od razu pojawia się na hubie — bez restartu kontenera.

## Który kafelek czego wymaga

Trzy poziomy: (1) działa od razu z samym `docker compose up`, (2) wymaga
dodatkowego sekretu/serwisu, który JEST już wpięty w ten compose — tylko
trzeba go dostarczyć w `.env`, (3) wymaga infrastruktury spoza tego repo,
nie stawianej przez ten compose w ogóle.

### 1 — Działa od razu, zero dodatkowej konfiguracji

| Kafelek | Dlaczego |
|---|---|
| Kalkulator GEO Score | Analiza to spaCy — własny mikroserwis Python (`geo-score-calculator` w tym compose), zero wywołań LLM. Jedyny nowy kafelek z realnym wynikiem "od ręki". |
| Konfiguracja Systemu / Cortex Config | Czyste CRUD na Postgresie, bez zewnętrznych zależności. |
| Okna Czasowe | Gada bezpośrednio z publicznym API JustWatch + lokalny plikowy store — potrzebuje tylko dostępu do internetu, nie cortex-proxy. |

### 2 — Działa w pełni po dostarczeniu sekretu/serwisu (już wpięte w ten compose)

| Kafelek | Czego brakuje | Jak dostarczyć |
|---|---|---|
| Content Guru, Visual Guru, Ilustromat | `cortex-proxy` (LLM/generowanie obrazów) | `cd ~/REPO/cortex-proxy && docker compose up -d` — domyślny `CORTEX_PROXY_URL=http://host.docker.internal:8240` już na to celuje |
| AI Tools (LinkedIn Generator, AI Summarizer, Text Highlighter/Transformer/Analyzer, Fakturomat, Generator Prezentacji, Asystent Dnia) | jw. | jw. |
| Parser Dokumentów | jw. **+** `DOCUMENT_PARSER_VISION_MODEL` (domyślnie puste — legacy placeholder był jawnie nienazwany) | uruchom `cortex-proxy` **i** ustaw w `.env` realny model wizyjny dostępny przez Twój proxy; bez tego upload/konwersja LibreOffice działają, ekstrakcja kończy się czytelnym `DependencyError` |
| Raportowanie Tokenów | `CORTEX_PROXY_ADMIN_API_KEY` — INNY sekret niż `CORTEX_PROXY_API_KEY` (nagłówek `X-Admin-API-Key`, sprawdzany przeciw `ADMIN_API_KEY` w env Twojego cortex-proxy; pomylenie daje ciche 401) | ustaw w `.env`, wartość z `ADMIN_API_KEY` instancji cortex-proxy, do której celujesz |
| Cortex Cowork | `cortex-proxy` — tak samo jak kafelki wyżej. Model jest per-projekt (Cortex Config → `governance.json`), a domyślny projekt celuje w `CORTEX_PROXY_URL`; ŻADEN klucz providera nie jest potrzebny (cortex-proxy nie waliduje klucza klienta). Obraz Dockera już buduje i kopiuje `cowork-runner/` (etap `cowork-runner-deps`), `node:22-alpine` sam spełnia wymóg Flue (>=22.19), więc `COWORK_NODE_BIN` niepotrzebny w Dockerze | `cd ~/REPO/cortex-proxy && docker compose up -d` — jw. Bez działającego proxy runner startuje, ale przebieg kończy się błędem i `chat-engine.ts` degraduje turę do deterministycznego routera słów kluczowych zamiast realnego agenta LLM |

### 3 — NIE zadziała w tym compose — potrzebuje osobnej infrastruktury spoza tego repo

| Kafelek | Czego potrzebuje |
|---|---|
| IDP, IDP Basic, Intrastat, Nadzorca Faktur (Invoice Supervisor) | Każdy proxuje do WŁASNEGO, osobnego backendu (`IDP_BACKEND_URL`, `IDP_BASIC_BACKEND_URL`, `INTRASTAT_BACKEND_URL`, `INVOICE_SUPERVISOR_BACKEND_URL` — patrz `.env.example`) — osobne repozytoria, nie stawiane przez ten compose |
| Store PIT | Brak w kodzie realnej integracji backendowej (żadnych route'ów API) — wygląda na jeszcze niedociągnięty na froncie poza szkieletem UI, nie sprawdzane dogłębnie |
| Konfiguracja Systemu — **tylko** synchronizacja uprawnień do OpenWebUI | Sam kafelek działa w pełni bez niczego (kategoria 1). Wyłącznie mapowanie ról na grupy OpenWebUI wymaga instancji `chat` z osobnego repo — patrz sekcja niżej. Puste `OPENWEBUI_*` = sync wyłączona ze statusem "skipped", reszta modułu bez zmian |

## Uruchomienie cortex-proxy (opcjonalnie)

```bash
cd ~/REPO/cortex-proxy && docker compose up -d
```

Bez tego wywołania modeli (kategoria 2 wyżej) kończą się czytelnym błędem
(503/502), reszta appki (nawigacja, RBAC, listy, konfiguracja) działa
normalnie.

## Synchronizacja uprawnień do OpenWebUI (opcjonalnie)

Domyślny `docker compose up` **nie** stawia OpenWebUI i nie wpina się w jego
sieć — `chat` żyje w osobnym repo (`~/REPO/chat`) razem ze swoimi patchami
i brandingiem. Żeby przetestować mapowanie ról na grupy OpenWebUI, dołóż
override:

```bash
docker compose -f docker-compose.yml -f docker-compose.openwebui-local.yml up -d
```

**Pełny runbook od zera — sieć `run_default`, bootstrap pierwszego admina,
wygenerowanie klucza `sk-` — jest w komentarzu na górze
`docker-compose.openwebui-local.yml`**, a nie tutaj. Świadomie w jednym
miejscu: to instrukcja do cudzego projektu open source, która rozjedzie się
z rzeczywistością przy każdym jego wydaniu, więc druga kopia tutaj byłaby
drugą rzeczą do utrzymywania.

Dwa punkty, na których najłatwiej się wyłożyć, warte wypisania z góry:

- **`ENABLE_API_KEYS` jest w OpenWebUI domyślnie `False`** (zweryfikowane na
  0.11.0). Bez włączenia `POST /api/v1/auths/api_key` zwraca 403, więc nie da
  się w ogóle uzyskać tokenu. Włączać trwale w `~/REPO/chat/docker-compose.yml`
  — ustawienie z panelu admina działa od ręki, ale jest stanem w bazie
  OpenWebUI i nie przeżyje `docker compose down -v`.
- **`OPENWEBUI_ADMIN_TOKEN` to klucz `sk-`, nie JWT z `/auths/signin`.** JWT
  wygasa (`JWT_EXPIRES_IN`, domyślnie 4 tygodnie) i sync zacznie wtedy zwracać
  "OpenWebUI odrzucił token administracyjny" bez żadnej innej zmiany po naszej
  stronie.

Kierunek synchronizacji jest jednostronny: `system_config` → OpenWebUI. Ręczna
zmiana członkostwa w UI OpenWebUI zostanie cofnięta przy najbliższym
uzgodnieniu — to jest zamierzone, nie błąd.

## Licencjonowanie modułów (`ENABLED_MODULES`, opcjonalne)

Domyślnie każdy zarejestrowany manifest kafelka (`kind=native`, jeszcze
nieaktywowany w tej instancji) pojawia się jako kandydat w **Konfiguracja
Systemu → Aplikacje → Dodaj aplikację**. Ustawiając w `.env` obok
`docker-compose.yml`:

```bash
ENABLED_MODULES=content-guru,visual-guru,geo-score-calculator
```

ograniczasz tę listę wyłącznie do wymienionych kodów — pozostałe kandydaci
(np. `document-parser`, gdyby nie był na liście) po prostu nie pojawią się w
SELECT-cie, jakby ich manifest nigdy nie został zarejestrowany. Puste albo
nieustawione = bez ograniczeń (zachowanie sprzed tej zmiennej).

Nie dotyczy to modułów już aktywowanych w Twojej instancji (w tym całego
rdzenia platformy — `idp`, `system-config`, `cortex-config`, `ai-tools`...) —
świadomy zakres pierwszej wersji, patrz `PROJECT/cortex-frontend-module-
licensing-mvp.md` w Obsidianie. Jeśli po ustawieniu tej zmiennej brakuje Ci
w picker'ze kafelka, którego się spodziewałeś, sprawdź najpierw, czy jego kod
faktycznie jest na liście.

## Zatrzymanie / reset

```bash
docker compose down          # zatrzymuje, dane w Postgresie zostają
docker compose down -v       # + kasuje wolumen Postgresa — następny `up` startuje od zera
```

## Rozwiązywanie problemów

**Port 3000 (albo 5432) zajęty** — nadpisz w `.env` obok `docker-compose.yml`:
`FRONTEND_PORT=3001` i/lub `POSTGRES_PORT=5433`.

**Zalogowany jako `dev@cortex.local`, ale kafelek pokazuje brak dostępu** —
sprawdź, czy to jeden z trzech kafelków wymagających ręcznej aktywacji (patrz
wyżej). Dla pozostałych: `docker compose down -v && docker compose up` daje
czysty start z pełnym grantem.

**`docker compose up` wisi na `migrate`** — `docker compose logs migrate`;
najczęstsza przyczyna to Postgres, który jeszcze nie zdążył przejść
healthchecka (`depends_on: condition: service_healthy` powinno to obsłużyć
samo, ale przy bardzo wolnym dysku daj mu chwilę więcej).

**Generowanie AI zwraca błąd** — sprawdź, czy `cortex-proxy` faktycznie
działa i czy `CORTEX_PROXY_URL` w Twoim `.env` (jeśli nadpisany) na niego
wskazuje — patrz sekcja wyżej.
