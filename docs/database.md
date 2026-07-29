# Baza danych

Status: obowiązujące od 29.07.2026. Kontekst: Obsidian `PROJECT/cortex-frontend-tiles-architektura.md` + `PROJECT/cortex-frontend-tiles-roadmap-mvp.md`.

## Reguła: jedna instancja Postgres, schema-per-moduł

Nie osobne bazy per moduł, nie SQLite per moduł. Każdy moduł portowany do środka monolitu dostaje własny `CREATE SCHEMA <modul>` w JEDNEJ instancji Postgres. Cross-modułowy dostęp przez `code-service`, nigdy bezpośredni SQL JOIN między schematami różnych modułów.

## Co WCHODZI do tej bazy

Moduły, które są częścią TEGO appu: uprawnienia/RBAC (`system_config`), rejestr kafelków, historia AI Tools (dziś w SQLite — migracja zaplanowana, patrz niżej).

## Co NIE wchodzi — i dlaczego to nie jest niespójność

`cortex-proxy` (LLM gateway) i `chat`/OpenWebUI zostają na zewnątrz, ze swoim własnym storage, zintegrowane przez `code-integration`. Zbadane i potwierdzone (29.07.2026): `cortex-proxy` jest używany przez min. 10 niepowiązanych repo w organizacji poza cortex-frontend — to prawdziwy, ekosystemowy serwis wielu konsumentów, nie moduł tej appki. Jego SQLite trzyma wyłącznie logi tokenów keyed po przekazanym `X-User-ID`/`X-Scope` — zero własnych tabel users/roles, zero konfliktu modelu danych z naszym RBAC. Zasada "jedna baza" dotyczy wyłącznie modułów WEWNĄTRZ monolitu — zgodne z udokumentowanym wzorcem modularnego monolitu (shared schema wewnątrz, database-per-service dla faktycznie osobnych, wielo-konsumenckich serwisów na zewnątrz).

## Drizzle — konwencje

Pełny wzorzec + pułapka kolizji tabeli migracji: `.claude/skills/code-db/REFERENCE.md`.

## Znany dług do zaadresowania

`app/idp/app/api/_lib/ai-tools-history.ts` używa dziś surowego `node:sqlite` (plik per tool w `.data/ai-tools-history/`). Decyzja: migrować na Postgres, nie zostawiać jako wyjątek — pierwszy kandydat po uruchomieniu `@cortex/db`.
