# Infrastruktura

Status: obowiązujące od 29.07.2026. Zweryfikowane w kodzie (`caddy/`, `chat/`, `devops/`), nie z pamięci. Pełny opis: Obsidian `PROJECT/cortex-frontend-architektura-docelowa.md`.

## Auth — jeden login dla całej domeny, już gotowy wzorzec

```
Internet → Caddy (80/443, TLS) → forward_auth → oauth2-proxy (JEDNA instancja) → Keycloak
                                        ↓ po sukcesie: X-Auth-Request-Email
                    cortex-frontend · chat/OpenWebUI · przyszłe moduły
```

Cookie sesji oauth2-proxy ważny na całą domenę (`*.<domena>`) — jedno logowanie obsługuje wszystkie subdomeny. **OpenWebUI już jest w tym samym SSO** — potwierdzone: `chat/docker-compose.yml` ma `WEBUI_AUTH_TRUSTED_EMAIL_HEADER=X-Auth-Request-Email`. Nic nowego nie trzeba budować na poziomie "jak zalogować użytkownika".

## Jeden `docker-compose.yml` na cały stack — build vs. deploy, ważne rozróżnienie

**Build i deploy to dwie różne warstwy, `include:` dotyczy tylko drugiej.** Każde repo (cortex-frontend, idp, invoice_supervisor, cortex-proxy) nadal buduje WŁASNY, osobny obraz przez WŁASNE CI (tag → GitHub Actions → `ghcr.io/panadeo/<repo>:vX`) — zero zmian względem dziś. `docker-compose.yml` z `include:` nic nie buduje — działa na serwerze przy `docker compose up`, składając już gotowe obrazy w jeden uruchomiony stack. Wersje dobierane przez `IMAGE_TAG` per serwis w `.env` (już istniejący wzorzec, np. `idp/docker-compose.image.yml`: `image: ghcr.io/panadeo/idp:${IMAGE_TAG:-latest}`) — nie git submodules (nieużywane nigdzie w tej organizacji, nie rozwiązują problemu spinania osobno budowanych obrazów, tylko współlokują kod źródłowy).

**Gdzie fizycznie leży ten plik**: `cortex-frontend/infra/docker-compose.yml` — w TYM repo, nie w osobnym. Korekta 29.07.2026: wcześniej rozważany osobny "stack repo" — wycofane, bo zwiększałoby rozproszenie zamiast je zmniejszać (patrz sekcja niżej). Wzorem `cortex2` (POC), które trzyma dokładnie ten plik u siebie w `infra/docker-compose.yml`, nie w osobnym repo.

Cel: `docker compose up` = cały `cortex-next` wstaje. Serwisy: Caddy, oauth2-proxy, Keycloak, Postgres, cortex-proxy, cortex-frontend, chat.

**Kolejność wdrożenia (5 serwisów):** Caddy → Keycloak → cortex-proxy → cortex-frontend → chat. `cortex-admin` NIE wchodzi jako osobny serwis — jego rolę przejmuje moduł Konfiguracja Systemu wewnątrz cortex-frontend.

## Nowy, cięższy backend dla kafelka (przyszłość) — `services/` w TYM repo, nie osobny repo

Reguła (29.07.2026): jeśli nowy kafelek potrzebuje backendu w innym języku/runtime niż Node (np. Python do ciężkiego przetwarzania obrazu/ML) — dostaje folder `services/<nazwa>/` W TYM repo, nie osobne repo. Precedens już istnieje: `cowork-runner/` (samodzielny serwis Node/Flue, własny `package.json`, spawnowany jako subproces przez Next.js, żyje w `cortex-frontend`) — ten sam wzorzec co `services/gateway`+`services/pii` w cortex2. Własny Dockerfile, własny build w `infra/docker-compose.yml` (budowany z lokalnego kontekstu, nie z zewnętrznego obrazu) — ale jedna historia gita/PR/kontekst dla LLM, zero ryzyka rozjazdu kontraktu między frontem a backendem.

**Osobny repo zostaje WYŁĄCZNIE dla:** (a) prawdziwie współdzielonych, wielo-konsumenckich usług ekosystemu (cortex-proxy, chat), (b) już istniejących, dojrzałych systemów zbyt ryzykownych do przeniesienia teraz (IDP, invoice-supervisor, patrz niżej). Dla nowego kafelka budowanego od zera (np. przyszły Ilustromat-w-cortex-frontend, gdyby ten temat wrócił) domyślnie `services/`, nie nowy repo.

## Trzecia kategoria: backendy modułów za duże/ryzykowne żeby portować (IDP, invoice-supervisor)

Różni się od cortex-proxy/chat (te są dzielone w całym ekosystemie) — IDP-backend i invoice-supervisor-backend są używane WYŁĄCZNIE przez cortex-frontend, ale są zbyt duże/dojrzałe żeby portować na TypeScript teraz (IDP ma własnego Postgresa + RabbitMQ dla workera — potwierdzone w `idp/docker-compose.image.yml`). Zostają jako osobne repo/serwisy z własną bazą, ALE dołączone do tego samego stacku przez `include:` (patrz `.claude/skills/code-compose/SKILL.md`) — nie hipoteza, oba repo mają już gotowe pliki compose:

```yaml
include:
  - path: ../idp/docker-compose.image.yml
    project_directory: ../idp
  - path: ../invoice_supervisor/docker-compose.next.yml
    project_directory: ../invoice_supervisor
```

Uwaga: `invoice_supervisor/docker-compose.next.yml` uruchamia TEŻ własny, osobny frontend Next.js (`frontend-next`, port 3000) — do świadomej decyzji przy kafelku "Nadzorca Faktur" (P2, nie teraz), czy zostaje osobną appką (link) czy UI wchodzi natywnie do cortex-frontend wołając tylko `backend-next`.

**Świadomy kompromis:** to odchodzi od dzisiejszego wzorca floty ITSG (osobny playbook Ansible+Semaphore per serwis). Uzasadnione dla tego poligonu (szybszy start, jeden model mentalny) — odwracalne później (rozbicie z powrotem na playbooki nie wymaga przepisywania).

## "Wszystko jest rozproszone" — konkretna, ograniczona lista, nie wszystko

Odpowiedź na obawę Alexa (29.07.2026): rozproszenie dotyczy TYLKO trzech rzeczy, z realnego powodu (inny język/stack, portowanie na TypeScript zbyt ryzykowne/kosztowne):
1. IDP-backend (Python/FastAPI, własny Postgres+RabbitMQ)
2. invoice-supervisor-backend (Python/FastAPI)
3. cortex-proxy (Go)

Dotykane tylko przy pracy NAD nimi samymi, nie przy zwykłej pracy nad kafelkiem. **Cała reszta — każdy nowy kafelek, RBAC, rejestr kafelków, logika biznesowa — jest już skonsolidowana w jednym pnpm/turbo monorepo w `cortex-frontend`** (patrz `docs/modular-monolith.md`). Caddy/Keycloak/chat to gotowe, off-the-shelf obrazy (nie nasz kod) — konfigurowane przez env, nie kod, do których nikt nie zagląda w codziennym developmencie.

## Dopisanie nowej, wieloserwisowej rodziny

Patrz `.claude/skills/code-compose/SKILL.md` — `include:` + `profiles`. **Nie dotyczy dziś meeting-guru** — sprawdzone (`gh api`): to rozproszony zestaw 4 komponentów (2× Vercel bez Dockera, 1× zupełnie inna domena `itsg-global.net`, 1× tylko VPN mesh) — kafelek "Nagrywanie Spotkań" to czysty link, nie integracja compose.
