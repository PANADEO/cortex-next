---
name: code-compose
description: Dopisanie usługi/rodziny usług do jednego docker-compose.yml (include:+profiles). Użyj przy dodawaniu nowego kontenera do środowiska cortex-next.
---

# code-compose

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
