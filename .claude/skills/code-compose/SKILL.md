---
name: code-compose
description: Dopisanie usługi/rodziny usług do docker-compose (include:+profiles) w cortex-frontend. Użyj przy dodawaniu nowego kontenera do środowiska cortex-next albo dowolnej edycji pliku compose. UWAGA — są DWA pliki compose, które muszą pozostać zgodne; łańcuch seedów w usłudze `migrate` → code-seed.
---

# code-compose

## Najpierw: są DWA pliki compose i rozjazd między nimi jest cichy

```
docker-compose.yml         — lokalnie, buduje obrazy ze źródeł (build:)
docker-compose.image.yml   — wdrożenia, ciągnie gotowe obrazy (image:)
```

Różnią się **prawnie** (build vs image, nazwy kontenerów, `ENVIRONMENT_TAG`), więc nie porównuj ich całych. Ale `command:` usługi `migrate` — czyli łańcuch migracji i seedów — musi być w obu **identyczny co do listy i kolejności**. Edycja tylko jednego z nich daje defekt widoczny wyłącznie na wdrożeniu, przy zielonych testach lokalnie; zdarzyło się dwa razy (`token-usage`, GEO Score), więc reguła ma dziś test: `packages/@cortex/db/scripts/seed-chain-parity.test.ts`. Szczegóły i podział ról → **`code-seed`**.

`pnpm lint` obejmuje wyłącznie `{app,packages}/**/*.{ts,tsx}` — **plików compose nie sprawdza nic poza tym testem.**

## Reguła

Jeden `docker-compose.yml` uruchamia CAŁY stack (`docker compose up`). Nowa, wieloserwisowa "rodzina" (jak przyszły odpowiednik meeting-guru, GDYBY był w pełni skonteneryzowany — meeting-guru dziś nim nie jest, patrz `docs/infrastructure.md`) dostaje WŁASNY `docker-compose.yml` w swoim repo, master plik dociąga go przez `include:`, nie kopiuje definicji.

```yaml
include:
  - path: ../<rodzina>/docker-compose.prod.yml
    project_directory: ../<rodzina>
```

Opcjonalne rodziny przez `profiles`, nie przez komentowanie serwisów:

```yaml
services:
  <rodzina>-backend:
    profiles: ["<rodzina>"]
```

`docker compose up` = tylko core. `docker compose --profile <rodzina> up` = dokłada rodzinę.

## Pułapki

- Konflikty nazw serwisów/sieci między plikami NIE scalają się cicho — prefiksuj nazwy serwisów nazwą rodziny.
- Zmienne env głównego pliku nadpisują dołączane — dokumentuj które zmienne submoduł oczekuje z góry.
- `include:` wymaga ścieżki lokalnej na dysku — repo musi być już sklonowane obok (tak jak dziś robi `devops`/Ansible).
- Jedna konwencja nazwy pliku compose per repo (`docker-compose.yml` albo zawsze `docker-compose.prod.yml`) — brak konwencji utrudnia generyczny `include:`.
