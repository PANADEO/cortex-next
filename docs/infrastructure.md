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

## Trzy różne kategorie "na zewnątrz" — różne powody, nie jedno uzasadnienie

Poprawka 29.07.2026 (pytanie Alexa: czy naprawdę trzeba, i czy to w ogóle "services"): wcześniejsza wersja tej notatki zlepiała trzy różne rzeczy pod jednym uzasadnieniem ("współdzielone w ekosystemie"). Rozdzielone:

### 1. `services/` w TYM repo — domyślna odpowiedź dla NOWEGO backendu kafelka

Jeśli nowy kafelek potrzebuje backendu w innym języku/runtime niż Node (np. Python do przetwarzania obrazu/ML) i **nigdy nie działa niezależnie od cortex-frontend** — dostaje folder `services/<nazwa>/` w TYM repo, nie osobny repo. Precedens już istnieje: `cowork-runner/` (samodzielny serwis Node/Flue, własny `package.json`, spawnowany jako subproces przez Next.js) — ten sam wzorzec co `services/gateway`+`services/pii` w cortex2. Własny Dockerfile, własny build w `infra/docker-compose.yml`, ale jedna historia gita/PR/kontekst dla LLM.

**Test, czy coś kwalifikuje się do `services/`:** czy to jest KIEDYKOLWIEK wdrażane niezależnie, na środowisko bez cortex-frontend? Jeśli nie (jak `cowork-runner`) — `services/`. Jeśli tak — zostaje osobnym repo, patrz kategorie 2 i 3.

### 2. `cortex-proxy` / `chat` — to nie "nasze services", to zewnętrzne zależności platformowe

Zła nazwa wcześniej. `cortex-proxy` i `chat` nie są kandydatami do `services/` w ogóle — to ta sama kategoria co wywołanie zewnętrznego API (OpenRouter, Stripe), nie "nasz kod w innym języku".

**cortex-proxy — zweryfikowany test "niezależnego wdrożenia", nie tylko "wielu konsumentów":** `devops/inventory/hosts` ma osobne grupy serwerów per klient (`jas_servers`, `ailly_servers`, `forsped_servers`, `bps_servers`, `sgb_servers`, `nexera_servers`...), a generyczny playbook `deploy-cortex-proxy.yml` wdraża go NIEZALEŻNIE na każdy z nich — większość tych klientów w ogóle nie ma cortex-frontend, tylko stary `cortex-box`+Streamlit. Potwierdzone też grepem: `invoice_supervisor`, `ilustromat`, `content-freshness-checker` wołają go niezależnie od cortex-frontend. Wrzucenie kodu cortex-proxy do `services/` oznaczałoby, że wdrożenie go u klienta bez cortex-frontend wymaga ciągnięcia całego repo Next.js po jeden folder.

**chat — inny powód, nie "wielu konsumentów":** to nie nasz kod w ogóle, tylko config+patche na cudzy projekt open source (OpenWebUI) — jak `keycloak` (config na cudzego Keycloaka). Mieszanie configu cudzego softu z naszym własnym kodem w `services/` myliłoby dwie różne kategorie.

### 3. IDP-backend / invoice-supervisor-backend — inny powód: ryzyko migracji, nie współdzielenie

W przeciwieństwie do (2), nie mam twardego dowodu że są dziś wdrażane niezależnie od cortex-frontend na innych klientach (możliwe przy rozłożonej w czasie migracji ze Streamlita, ale niesprawdzone). Powód, żeby zostały osobnym repo, jest INNY: własna, dojrzała baza (IDP ma Postgres+RabbitMQ dla workera — potwierdzone w `idp/docker-compose.image.yml`) i realne ryzyko/koszt przepisania na TypeScript teraz — nie "współdzielenie w ekosystemie". Dołączone do tego samego stacku przez `include:` (patrz `.claude/skills/code-compose/SKILL.md`), oba repo mają już gotowe pliki compose:

```yaml
include:
  - path: ../idp/docker-compose.image.yml
    project_directory: ../idp
  - path: ../invoice_supervisor/docker-compose.next.yml
    project_directory: ../invoice_supervisor
```

Uwaga: `invoice_supervisor/docker-compose.next.yml` uruchamia TEŻ własny, osobny frontend Next.js (`frontend-next`, port 3000) — do świadomej decyzji przy kafelku "Nadzorca Faktur" (P2, nie teraz), czy zostaje osobną appką (link) czy UI wchodzi natywnie do cortex-frontend wołając tylko `backend-next`.

**Świadomy kompromis (dotyczy 2+3):** to odchodzi od dzisiejszego wzorca floty ITSG (osobny playbook Ansible+Semaphore per serwis) dla samego `cortex-next`. Uzasadnione dla tego poligonu (szybszy start, jeden model mentalny) — odwracalne później.

## "Wszystko jest rozproszone" — konkretna, ograniczona lista, nie wszystko

Rozproszenie dotyczy TYLKO trzech rzeczy, każda z INNEGO powodu (patrz wyżej, nie jedno uzasadnienie): cortex-proxy (niezależnie wdrażany u wielu klientów bez cortex-frontend), chat (cudzy projekt, nie nasz kod), IDP+invoice-supervisor-backend (własna dojrzała baza, ryzyko migracji). Dotykane tylko przy pracy NAD nimi samymi, nie przy zwykłej pracy nad kafelkiem. **Cała reszta — każdy nowy kafelek, RBAC, rejestr kafelków, logika biznesowa, i każdy przyszły cięższy backend budowany od zera — jest lub będzie w jednym pnpm/turbo monorepo w `cortex-frontend`** (patrz `docs/modular-monolith.md`).

## Dopisanie nowej, wieloserwisowej rodziny

Patrz `.claude/skills/code-compose/SKILL.md` — `include:` + `profiles`. **Nie dotyczy dziś meeting-guru** — sprawdzone (`gh api`): to rozproszony zestaw 4 komponentów (2× Vercel bez Dockera, 1× zupełnie inna domena `itsg-global.net`, 1× tylko VPN mesh) — kafelek "Nagrywanie Spotkań" to czysty link, nie integracja compose.
