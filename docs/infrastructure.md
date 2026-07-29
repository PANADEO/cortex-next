# Infrastruktura

Status: obowiązujące od 29.07.2026. Zweryfikowane w kodzie (`caddy/`, `chat/`, `devops/`), nie z pamięci. Pełny opis: Obsidian `PROJECT/cortex-frontend-architektura-docelowa.md`.

## Auth — jeden login dla całej domeny, już gotowy wzorzec

```
Internet → Caddy (80/443, TLS) → forward_auth → oauth2-proxy (JEDNA instancja) → Keycloak
                                        ↓ po sukcesie: X-Auth-Request-Email
                    cortex-frontend · chat/OpenWebUI · przyszłe moduły
```

Cookie sesji oauth2-proxy ważny na całą domenę (`*.<domena>`) — jedno logowanie obsługuje wszystkie subdomeny. **OpenWebUI już jest w tym samym SSO** — potwierdzone: `chat/docker-compose.yml` ma `WEBUI_AUTH_TRUSTED_EMAIL_HEADER=X-Auth-Request-Email`. Nic nowego nie trzeba budować na poziomie "jak zalogować użytkownika".

## Jeden `docker-compose.yml` na cały stack

Cel: `docker compose up` = cały `cortex-next` wstaje. Wzorem `cortex2` (POC), które już to robi (`infra/docker-compose.yml`, "the intended single-command path"). Serwisy: Caddy, oauth2-proxy, Keycloak, Postgres, cortex-proxy, cortex-frontend, chat.

**Kolejność wdrożenia (5 serwisów):** Caddy → Keycloak → cortex-proxy → cortex-frontend → chat. `cortex-admin` NIE wchodzi jako osobny serwis — jego rolę przejmuje moduł Konfiguracja Systemu wewnątrz cortex-frontend.

**Świadomy kompromis:** to odchodzi od dzisiejszego wzorca floty ITSG (osobny playbook Ansible+Semaphore per serwis). Uzasadnione dla tego poligonu (szybszy start, jeden model mentalny) — odwracalne później (rozbicie z powrotem na playbooki nie wymaga przepisywania).

## Dopisanie nowej, wieloserwisowej rodziny

Patrz `.claude/skills/code-compose/SKILL.md` — `include:` + `profiles`. **Nie dotyczy dziś meeting-guru** — sprawdzone (`gh api`): to rozproszony zestaw 4 komponentów (2× Vercel bez Dockera, 1× zupełnie inna domena `itsg-global.net`, 1× tylko VPN mesh) — kafelek "Nagrywanie Spotkań" to czysty link, nie integracja compose.
