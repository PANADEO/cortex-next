---
name: code-db
description: Postgres + Drizzle w @cortex/db — jedna baza, schema-per-moduł. Użyj gdy dodajesz nową tabelę, nowy moduł z własnymi danymi, albo pytasz "gdzie/jak zapisać dane".
---

# code-db

## Reguła

**Jedna instancja Postgres dla wszystkich modułów portowanych do środka monolitu** (nie osobne bazy, nie SQLite per moduł). Każdy moduł dostaje własny `CREATE SCHEMA <modul>` — osobne tabele, brak bezpośrednich JOIN-ów między schematami modułów (dostęp cross-modułowy przez `code-service`, nie SQL).

**Czego NIE wciągamy do tej bazy**: `cortex-proxy`, `chat`/OpenWebUI, i inne faktycznie osobno wdrożone, wielo-konsumenckie serwisy ekosystemu — te zostają zewnętrzne, zintegrowane przez `code-integration`. Pełne uzasadnienie: `docs/database.md`.

## Jak dodać nowy schemat

1. `packages/@cortex/db/src/schema/<modul>.ts` — `pgSchema("<modul>")`, tabele w środku.
2. Osobny `migrationsSchema` per moduł w configu Drizzle dla tego schematu (patrz `REFERENCE.md` — bez tego druga i kolejne migracje potrafią zostać po cichu zignorowane).
3. `drizzle-kit generate` → `drizzle-kit migrate` (skrypty `db:generate`/`db:migrate` w `packages/@cortex/db/package.json`).

## Znany dług — historia AI Tools

`app/idp/app/api/_lib/ai-tools-history.ts` używa dziś surowego `node:sqlite` (plik per tool w `.data/ai-tools-history/`), nie Drizzle. Decyzja Alexa (29.07.2026): migrować na Postgres — to pierwszy kandydat po uruchomieniu `@cortex/db`, nie zostawiać jako wyjątek.

## Kolumna właściciela rekordu: `userEmail`

Tabela trzymająca rekordy należące do konkretnego użytkownika (historia, archiwum, dowolne "moje dane") dostaje `userEmail: text("user_email").notNull()` — **nie** FK do `system_config.users.id` (tożsamość w RBAC to wszędzie e-mail, nie surogat; FK międzyschematowy złamałby też regułę wyżej "brak bezpośrednich JOIN-ów między schematami modułów"). Nie mylić z `createdBy` (np. `ilustromat.frame_templates.created_by`) — to tylko ślad audytowy na zasobie WSPÓŁDZIELONYM między userami, nie filtr widoczności. Pełny wzorzec — gdzie żyje filtr w zapytaniu, jak dokłada się widok admina bez przebudowy, kształt funkcji listującej, seedowanie e2e dwóch userów — spisany raz w `code-service/SKILL.md`, sekcja "Rekordy per-user (`userEmail`)".

## Reguły

1. Nigdy bezpośredni SQL w `code-api`/`code-service` — zawsze przez Drizzle w `@cortex/db`.
2. Migracje zawsze przez `drizzle-kit`, nigdy ręczny ALTER na produkcji.
3. Nowy moduł = nowy schemat, nie nowa tabela w istniejącym schemacie innego modułu.
