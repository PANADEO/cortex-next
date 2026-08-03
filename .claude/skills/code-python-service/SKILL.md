---
name: code-python-service
description: Pierwszy Python fizycznie w tym monorepo — services/<nazwa>/ jako mikroserwis wołany server-side przez Next.js. Użyj przy dodawaniu nowego backendu Python (FastAPI) obok cortex-frontend — Dockerfile, docker-compose, CI, testy, sieć.
---

# code-python-service

## Kiedy używać

`docs/infrastructure.md`, "Trzy różne kategorie na zewnątrz", kategoria 1 — test: czy ten backend jest KIEDYKOLWIEK wdrażany niezależnie, na środowisko bez cortex-frontend? Jeśli nie → `services/<nazwa>/` w TYM repo, nie osobny repo.

**Start: skopiuj `services/_template-python-service/`** — to jest realny, zweryfikowany (`docker build`+`docker compose up`+`docker run ... pytest`, patrz sekcja "Zweryfikowane empirycznie" niżej) szkielet, nie pseudokod. Nie pisz Dockerfile/compose-wpisu/CI-joba od zera — skopiuj i rozbuduj.

## Struktura katalogu

```
services/<nazwa>/
├── Dockerfile
├── requirements.txt      # runtime + test deps RAZEM, jeden plik (patrz "Testy" niżej)
├── main.py                 # FastAPI app; GET /health obowiązkowe
├── pytest.ini
├── tests/
│   └── test_health.py
└── .dockerignore            # __pycache__/.pytest_cache/.venv — nie wciągać do obrazu
```

Serwis z drugim kontenerem (np. przyszły `document-parser` + jego `unoserver` sidecar, patrz `PROJECT/cortex-frontend-parser-dokumentow-port-projekt.md` §1.2/D3) dostaje po prostu drugi folder z własnym Dockerfile: `services/document-parser/unoserver/Dockerfile` obok `services/document-parser/Dockerfile` — CI (patrz niżej) znajduje oba automatycznie, bez zmian w YAML.

Realne serwisy rozrosną się (`main.py` → pakiet `src/` z `pipeline.py`, routerami itd.) — kształt szkieletu to punkt startowy, nie sztywna forma do wiecznego trzymania.

## Dockerfile — single-stage, świadomie NIE kopiuj wzorca Node

Root `Dockerfile` tego repo jest multi-stage (`deps`/`builder`/`runner`), bo `next build` produkuje skompilowane artefakty (standalone server, static assets), które trzeba wyekstrahować do szczuplejszego finalnego obrazu, a pnpm workspace ma layout symlinków wymagający izolacji od toolchainu builda. **Żaden z tych powodów nie dotyczy czystego Pythona**: `pip install -r requirements.txt` JEST krokiem builda — produkuje dokładnie środowisko runtime, którego appka potrzebuje, bez osobnego artefaktu do wyekstrahowania. `python:3.12-slim` to już najszczuplejsza sensowna baza.

Kiedy multi-stage faktycznie ma sens dla Pythona: gdy realny serwis potrzebuje kompilować natywne rozszerzenia bez gotowego wheela na docelową platformę — wtedy builder-stage kompiluje do venv/wheelhouse, a finalny stage kopiuje tylko wynik. Nie buduj tego z góry (YAGNI, `architecture_rules.md` §1) — dodaj, gdy konkretna zależność tego realnie wymaga.

Ustalone konwencje w szkielecie, do zachowania:
- `curl` doinstalowany przez `apt-get` — `python:slim` nie ma HTTP clienta na PATH, potrzebnego dla `HEALTHCHECK`.
- Nie-rootowy user (`useradd -m -u 1000 appuser`, `USER appuser`) — ten sam poziom higieny co `nextjs`/`nodejs` user w root Dockerfile.
- Port **8000** (domyślny uvicorna), nie 80 jak Node `runner` — to konwencja TEGO obrazu (Next.js), nie reguła całego repo. Serwisy Python, osiągalne wyłącznie przez Docker DNS, używają idiomatycznego dla FastAPI/uvicorn 8000. Realny serwis może użyć innego portu, jeśli ma po temu konkretny powód (np. zgodność z portem już ustalonym gdzie indziej) — udokumentuj wtedy dlaczego, tak jak tu.
- `HEALTHCHECK` woła `GET /health` — każdy serwis Python w `services/` MUSI mieć ten endpoint, niezależnie od reszty API.

## docker-compose wiring

- **Realne serwisy** (`geo-score-calculator`, `document-parser`) wchodzą do `docker-compose.yml` **BEZ profilu** — cortex-frontend realnie ich potrzebuje, mają startować z domyślnego `docker compose up`, tak jak `postgres`/`migrate`/`cortex-frontend` dziś.
- Szkielet (`template-python-service`) jest za profilem `python-template` (`docker compose --profile python-template up`) — to specyficzne dla faktu, że jest to content-free demo, nie realna funkcjonalność; **nie kopiuj tego elementu do realnego serwisu**.
- **BRAK `ports:`** — jedyna droga dostępu to Docker DNS (`http://<nazwa-serwisu>:<port>`) z innych kontenerów tej samej sieci compose. To postura bezpieczeństwa opisana w obu design dokach (GEO Score D3, Parser Dokumentów D6): serwis Python nigdy nie jest bezpośrednio adresowalny z przeglądarki ani z hosta. Next.js woła go WYŁĄCZNIE server-side (`code-integration`: adapter w `lib/<modul>/integration-client.ts`, `fetch`+`AbortController` timeout, błędy zmapowane na `502`) — nigdy przez middleware-level rewrite widoczny z przeglądarki (to byłby wzorzec `invoice-supervisor`, świadomie inny i tu nieużywany).
- **`docker-compose.image.yml`** (prod deploy z gotowych obrazów GHCR): dopisz wpis dopiero gdy CI faktycznie PUBLIKUJE obraz dla tego serwisu (`image: ghcr.io/panadeo/cortex-frontend/services/<nazwa>:${IMAGE_TAG:-latest}`, wzorem istniejących wpisów `cortex-frontend`/`migrate` w tym pliku). Wpis wskazujący na obraz, który nigdy nie został wypchnięty, cicho psuje realny `docker compose pull`/`up` na serwerze — dlatego szkielet (`_template-python-service`) świadomie NIE MA wpisu w `docker-compose.image.yml`, tylko w `docker-compose.yml`.

## CI — `.github/workflows/docker-build.yml`

Nowy, niezależny tor obok istniejącego joba `docker` (Next.js): `discover-python-services` → `python-services` (matrix).

- **Discovery jest dynamiczny** — job szuka `services/*/Dockerfile` i `services/*/*/Dockerfile` (jeden lub dwa poziomy głębokości, żeby złapać sidecary typu `unoserver`), pomijając katalogi zaczynające się od `_` (szkielet). **Dodanie nowego serwisu nie wymaga żadnej zmiany w YAML** — wystarczy folder z Dockerfile'em w `services/`.
- Dziś (services/ ma tylko `_template-python-service/`) `discover-python-services` znajduje zero kwalifikujących się serwisów, `python-services` się nie uruchamia (`if: has-services == 'true'`) — zweryfikowane lokalnym dry-runem logiki discovery (bash+jq), patrz niżej.
- Kolejność w `python-services`: **build lokalnie** (`load: true`, `push: false`) → **`pytest` WEWNĄTRZ zbudowanego obrazu** (`docker run <tag> pytest`) → **push dopiero po zielonym teście**. Świadomie inaczej niż `PANADEO/cortex-document-parser`'s `test`→`docker` (osobny job testujący na gołym runnerze, potem OSOBNY build): tu obraz, który faktycznie trafia do rejestru, jest DOKŁADNIE tym samym obrazem, w którym przeszły testy — zero driftu między środowiskiem testowym a runtime. To bezpośrednia odpowiedź na wzorzec błędu, który to repo już dwa razy popełniło (`token-usage` `ERR_MODULE_NOT_FOUND`, hub-render Krok 1b) — założenie o zawartości obrazu, nigdy nie sprawdzone W ŚRODKU obrazu.
- Nazwa obrazu: `ghcr.io/panadeo/cortex-frontend/services/<nazwa-z-myślnikami>` (np. `.../services/geo-score-calculator`, `.../services/document-parser-unoserver` dla sidecara).

**Niezweryfikowane w prawdziwym CI** (nie da się odpalić GitHub Actions lokalnie): sama logika discovery (bash+jq) była przetestowana lokalnie na mockowym drzewie katalogów z identycznym poleceniem, a `actionlint`+`shellcheck` przeszły na całym pliku bez błędów — ale żaden realny `push`/`workflow_dispatch` na GitHubie tego joba nie uruchomił.

## Testy — pytest

- `requirements.txt` zawiera runtime i test deps **RAZEM** (`fastapi`, `uvicorn`, `httpx`, `pytest`) — świadomie inaczej niż typowy Node split prod/dev. Powód: obraz produkcyjny i tak musi umieć uruchomić `pytest` sam w sobie w CI (sekcja wyżej) — potrzebuje mieć `pytest` zainstalowany, więc rozdzielanie na `requirements.txt`/`requirements-dev.txt` nie kupuje tu nic, tylko dodaje plik. Mirror konwencji już ustalonej w `PANADEO/cortex-document-parser` (ten sam wzorzec: jeden plik).
- `fastapi.testclient.TestClient` wymaga `httpx` (Starlette ≥0.36 przeniosło `TestClient` na `httpx`) — nie zapomnieć tej zależności, inaczej import się wywali dopiero przy odpaleniu testów.
- `GET /health` → `{"status": "ok"}` jest **obowiązkowy** w każdym serwisie — używany przez `HEALTHCHECK` w Dockerfile i potencjalnie przez panel diagnostyczny w Konfiguracji Systemu (patrz D1 w Parser Dokumentów: "Runtime & Audit" jako user-facing strona odpada, ale health-check backendu zostaje).

## Bezpieczeństwo — sieć wewnętrzna, zero RBAC w Pythonie

Serwis Python **nigdy** nie robi własnej autoryzacji i **nigdy** nie jest wystawiony na świat (brak `ports:`, patrz wyżej). `requireTileAccess()` w Next.js (`code-service`) jest jedynym punktem prawdy dla dostępu — dokładnie D6 z Parser Dokumentów. Nie replikuj wzorców auth z legacy Streamlit repo (`cortex_admin_client.py`/`permissions_service.py`) — ten zewnętrzny serwis już nie istnieje w tym repo (`code-service` SKILL.md).

## Zweryfikowane empirycznie (03.08.2026, `services/_template-python-service/`)

1. `docker build services/_template-python-service` — realny obraz, buduje się (fastapi/uvicorn/httpx/pytest instalują się czysto na `python:3.12-slim`).
2. `docker compose --profile python-template up -d template-python-service` — kontener startuje, `docker inspect` pokazuje `healthy` (HEALTHCHECK trafia własny `/health`).
3. **Reachability**: `docker run --rm --network cortex-frontend_default curlimages/curl curl http://template-python-service:8000/health` z osobnego kontenera → `{"status":"ok"}`, HTTP 200 — Docker DNS działa.
4. **Izolacja od hosta**: `curl http://localhost:8000/health` z hosta → `Connection refused` (curl exit 7); `docker port <kontener>` → puste — brak `ports:` faktycznie nic nie wystawia.
5. `docker run --rm <zbudowany-obraz> pytest` → `2 passed`, wewnątrz REALNEGO zbudowanego obrazu (nie lokalny Python hosta).
6. `actionlint` + `shellcheck` (via actionlint) na `.github/workflows/docker-build.yml` po dodaniu nowych jobów → zero błędów. Sama logika discovery (bash+jq) przetestowana osobno na mockowym drzewie (`_template-python-service` poprawnie wykluczony, `geo-score-calculator` + `document-parser` + `document-parser/unoserver` poprawnie znalezione z właściwymi `name`/`context`/`dockerfile`).
7. `pnpm typecheck` / `pnpm lint` na reszcie repo po zmianach w `docker-compose.yml`/`.dockerignore`/`.gitignore`/`.github/workflows/docker-build.yml` — bez regresji (te pliki nie dotykają kodu TS).

## Linki

- `services/_template-python-service/` — działający punkt startowy, skopiuj go.
- `docs/infrastructure.md` — "Trzy różne kategorie na zewnątrz", kategoria 1.
- `.claude/skills/code-integration/SKILL.md` — jak Next.js woła ten serwis (adapter, timeout, mapowanie błędów).
- `.claude/skills/code-config/SKILL.md` — `<MODUL>_SERVICE_URL` w `config.ts` modułu wołającego, nie centralna lista.
- `.claude/skills/code-compose/SKILL.md` — `include:`/`profiles`, dla WIELOSERWISOWEJ rodziny w OSOBNYM repo. **Nie dotyczy** `services/<nazwa>/` w tym repo — te wchodzą wprost do `docker-compose.yml`, bez `include:`.
- Obsidian `PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md`, `PROJECT/cortex-frontend-parser-dokumentow-port-projekt.md` — dwa realne serwisy, które mają użyć tego wzorca zamiast wynajdywać własny.
