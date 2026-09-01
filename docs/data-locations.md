# Gdzie moduły trzymają dane

Status: 29.07.2026. Pełny obraz stanu przejściowego — część modułów jeszcze nie na docelowym wzorcu (patrz `docs/database.md`).

| Moduł                                      | Dane                                    | Gdzie dziś                                                                                                         | Docelowo                                                                  |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| AI Tools (Sumaryzator, LinkedIn itd.)      | historia generacji                      | `.data/ai-tools-history/*.sqlite` (raw `node:sqlite`, plik per narzędzie)                                          | Postgres, schema `ai_tools`                                               |
| Cortex Cowork (governance agentów)         | projekty/role/skille/credentiale/sesje  | `app/idp/.data/cortex-cowork/*.json`                                                                               | **bez zmian teraz** — IDP/Cowork nietknięte, osobna decyzja na przyszłość |
| Okna czasowe                               | skany JustWatch                         | `app/idp/.data/okna-czasowe/*.json`                                                                                | bez zmian teraz, jak wyżej                                                |
| Konfiguracja Systemu (Ścieżka E, budowane) | users/role/permissions/rejestr kafelków | — (jeszcze nie istnieje)                                                                                           | Postgres, schema `system_config`, od startu na docelowym wzorcu           |
| Ilustromat (integracja, budowane)          | generowane obrazy, szablony marki       | **poza cortex-frontend** — żyje w osobnym serwisie Ilustromat                                                      | bez zmian — to `code-integration`, nie nasze dane                         |
| Raportowanie Tokenów                       | zużycie tokenów i liczba żądań          | **poza cortex-frontend** — SQLite w kontenerze cortex-proxy (`./data/cortex-proxy.db`), czytane przez `GET /usage` | bez zmian — `code-integration`, nie nasze dane                            |
| Asystent Onboardingowy / FAQ HR            | wiedza (Knowledge), historia rozmów     | **poza cortex-frontend** — żyje w OpenWebUI                                                                        | bez zmian — `external-link`, zero danych po naszej stronie                |

## Zasada

Nowy moduł zaczyna od razu na docelowym wzorcu (Postgres, `code-db`, schema-per-moduł) — nie kopiuje wzorca SQLite z AI Tools. Migracja AI Tools i ewentualna Cortex Cowork to osobne, świadome decyzje, nie "przy okazji".
