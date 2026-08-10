---
name: code-seed
description: Seedy w packages/@cortex/db/scripts — pętla uzgadniania wykonywana przy KAŻDYM deployu, nie fixture do testów. Użyj przy dodawaniu seeda dla nowego modułu, zmianie istniejącego, pytaniu "czemu ustawienie admina wróciło do starej wartości po wdrożeniu" albo "czemu kafelek działa lokalnie, a na wdrożeniu nie". NIE dla schematu/migracji (→ code-db) ani dla samej bramki licencyjnej (→ code-license).
---

# code-seed

## Czym seed TU jest

Nie fixture i nie dane demo. **Skrypty w `packages/@cortex/db/scripts/` to pętla uzgadniania stanu instancji, wykonywana przy każdym `docker compose up`** — usługa `migrate` uruchamia je łańcuchem spiętym przez `&&`, przed startem aplikacji. Powłoka jest fail-closed wobec Postgresa (kod nieobecny w `system_config.applications` nie trafi do `GET /api/me/access` **nigdy**), więc deploy bez seeda nie daje instancji zubożonej — daje instancję zepsutą.

Dlatego każdy seed musi być **idempotentny** i wolno (i trzeba) go uruchamiać wielokrotnie.

## Łańcuch i jego kolejność

```
migrate.mjs                     ← schemat MUSI istnieć, zanim cokolwiek pisze
  └─ seed-tile-manifests.mjs    ← rejestracja kafelków z manifestów
      └─ seed-system-config.mjs ← grant admina "wszystkie wiersze applications"
          └─ seed-ilustromat.mjs, seed-token-usage.mjs,
             seed-geo-score-calculator.mjs, seed-content-guru.mjs
```

Dwie zależności kolejnościowe są **znaczące**, nie kosmetyczne:

- `migrate.mjs` przed każdym seedem — seedy piszą do tabel, których schemat tworzą migracje. Dodatkowo migracja danych `drizzle/system-config/0005_bitter_shadowcat.sql` backfilluje `show_on_hub` i chroni ją przed dotknięciem świeżych uprawnień wyłącznie to, że w chwili jej wykonania ich wierszy jeszcze nie ma.
- `seed-tile-manifests.mjs` przed `seed-system-config.mjs` — blok grantowania admina obejmuje „wszystkie wiersze `applications`", więc musi zobaczyć też świeżo zarejestrowane kody. Inaczej świeża instancja ma administratora bez dostępu do kafelków zarejestrowanych z manifestu.

**Łańcuch jest zduplikowany w TRZECH miejscach** i tylko dwa z nich mają strażnika:

| Kopia | Pilnowana? |
|---|---|
| `docker-compose.yml` (lokalnie, build ze źródeł) | ✅ `seed-chain-parity.test.ts` |
| `docker-compose.image.yml` (wdrożenia, gotowe obrazy) | ✅ ten sam test |
| `SEED_SCRIPTS` w `e2e/fixtures/db-seed.ts` (`runRegistrySeed()`) | ❌ **nic** |

Dwa pliki compose muszą być identyczne co do listy i kolejności — `seed-chain-parity.test.ts` ma zahardkodowane `COMPOSE_FILES` i **nie sięga do e2e**. Trzecia kopia już się rozjechała: niesie 4 z 6 seedów (brak `seed-geo-score-calculator.mjs` i `seed-content-guru.mjs`) i nie ma `migrate.mjs`, mimo że jej własny komentarz wymaga zgodności z usługą `migrate`. To znany dług, nie projekt.

Praktyczny skutek: **zaktualizowanie obu plików compose nie wystarcza** — e2e zostanie nieaktualne i nic się nie zaświeci na czerwono. Nie polegaj też na komentarzu w nagłówku; nie wystarczył dwa razy, patrz „Trzy defekty" niżej.

## Podział własności kolumn — jedyna reguła, która naprawdę boli

```
INSERT (pierwszy deploy z tym kodem)     do update set (KAŻDY kolejny deploy)
──────────────────────────────────────   ──────────────────────────────────────
code (klucz konfliktu)                   WYŁĄCZNIE fakty o kodzie:
kind, route, url, target                   kind, route, url, target, updated_at
wartości POCZĄTKOWE z manifestu:
  name, description, icon, color,        ← ANI JEDNEJ kolumny należącej do admina
  category_functional, category_department,
  sort_order, show_on_hub
stałe: is_active = false, activated_at = null
```

**Kolumna, którą admin może edytować w UI, nie ma prawa znaleźć się w `do update set`.** Wpisana tam, wraca do wartości z seeda przy każdym wdrożeniu — użytkownik ustawia kategorię, po deployu jest z powrotem stara, i nic w UI o tym nie mówi. To był defekt B1 tego repo; nośnik (statyczna lista `APPLICATIONS`) zniknął w `df5d171`, a `seed-tile-manifests.mjs` jest ostatnim miejscem, w którym dałoby się tę pomyłkę powtórzyć. Strażnik: `seed-tile-manifests-insert-only.test.ts`.

Manifest odpowiada na pytanie **„skąd bierze się wartość początkowa"**, nie na „kto jest właścicielem wartości w runtime". Właścicielem w runtime jest admin.

Istnieje **dozwolony** sposób zapisania kolumny admina — ale to jest OSOBNY `update`, nie klauzula w upsercie:

```sql
update system_config.applications
   set is_active = true, show_on_hub = true, activated_at = now(), color = 'sky', ...
 where id = ${applicationId} and activated_at is null    -- ← „tylko jeśli instancja nigdy tego nie włączyła"
```

Tak robią `seed-token-usage.mjs` i `seed-ilustromat.mjs`. Zapisują kolumny należące do admina (`color`, `category_*`, `description`, `icon`, `show_on_hub`) i jest to poprawne, bo guard sprawia, że dzieje się to **raz w życiu instancji**.

**Nie przenoś tego guardu do `on conflict ... do update set`.** Dziś nie robi tego ani jeden plik w repo. `ON CONFLICT ... DO UPDATE ... WHERE` w Postgresie ma inną semantykę niż guard per-kolumna (`case when ... then excluded.x else ... end`) — a ta druga forma żyła wyłącznie w przed-K3 `seed-system-config.mjs` i **zniknęła razem z nim** w `df5d171`. Napisana od nowa wyląduje dokładnie w tym zdaniu SQL, którego pilnuje `seed-tile-manifests-insert-only.test.ts`.

I tak, i tak: guard służy regule uzgadniania, nie naprawie stanu zastanego. Naprawa ma się **skończyć**, a seed biegnie zawsze — wyjątek wpisany tutaj zostaje na zawsze. Backfille jadą jednorazową migracją danych (`packages/@cortex/db/drizzle/system-config/0005_bitter_shadowcat.sql`).

## Czysty `.mjs`, zero toolchainu — i co z tego wynika

Usługa `migrate` startuje z obrazu `runner`, w którym **nie ma TypeScriptu, nie ma zbudowanego `@cortex/service` i nie ma plików `app/idp/app/(main)/**`**. Seed nie może więc zaimportować niczego z `app/` ani z pakietów TS.

Skutki, z którymi trzeba żyć:

- **Manifesty docierają do seeda jako JSON.** Etap `builder` w `Dockerfile` uruchamia `scripts/generate-tile-manifests.mjs`, który bundluje barrel `app/idp/lib/tile-manifests.ts` (esbuild) i zapisuje `packages/@cortex/db/scripts/tile-manifests.generated.json`. Seed czyta wyłącznie ten plik.
- **Logika współdzielona z aplikacją bywa zduplikowana**, np. `isModuleEnabled()` (→ `code-license`). Każda taka kopia dostaje test parzystości wykonujący **obie** implementacje na tych samych wejściach — sam komentarz nie wystarcza, bo rozjazd jest cichy.

Strażniki w tym katalogu — **parzystości**: `module-licensing.parity.test.mjs`, `seed-chain-parity.test.ts`, `compose-db-parity.test.ts`, `migrations-journal-parity.test.ts`, `tile-registry-parity.test.ts`. Osobno `scripts-parse.test.ts` — to nie parzystość, tylko `node --check` po każdym `.mjs` (błąd składni w seedzie zatrzymałby deploy dopiero na wdrożeniu).

> **Wszystkie te bramki są LOKALNE.** CI (`.github/workflows/docker-build.yml`) nie uruchamia vitest w ogóle, a połowa `tile-registry-parity.test.ts` dotycząca bazy odpala się wyłącznie przy ustawionym `DATABASE_URL`. „Test tego pilnuje" znaczy tu „`pnpm test` na twojej maszynie to złapie" — nie „nie da się tego wdrożyć".

## Rzucać czy pomijać

Łańcuch jest spięty przez `&&`, więc **rzucenie zatrzymuje deploy**. Wybór jest więc realny i idzie po skutku, nie po „powadze":

- **Rzuć**, gdy dalszy bieg zostawiłby instancję niesprawną i nikt tego nie zauważy — np. rdzeń `system-config`, którego nie da się aktywować. Lepszy zatrzymany deploy niż instancja bez administratora.
- **Pomiń z czytelnym logiem**, gdy przyczyną jest konfiguracja deployu, a reszta ma prawo się udać — np. kod z `BOOTSTRAP_MODULES` spoza licencji. Jedna literówka w `.env` nie może kosztować całego środowiska.

## Trzy defekty produkcyjne, przed którymi bronią powyższe reguły

Nie hipotetyczne — wszystkie trzy zdarzyły się w tym repo:

1. **`token-usage` martwy po `docker compose up`** (do 30.07.2026) — seed dopisany tylko do jednego pliku compose.
2. **Cały kafelek GEO Score niesprawny na KAŻDYM wdrożeniu z obrazu** (05.08.2026) — `seed-geo-score-calculator.mjs` trafił znowu tylko do wersji lokalnej. Ostrzej niż za pierwszym razem, bo `getGeoScoreConfig()` rzuca przy braku wiersza singletona, więc każda analiza wywalała się na starcie. Lokalnie wszystko działało. Dopiero po tym drugim razie reguła dostała test.
3. **Kategoria ustawiona przez admina wracała po każdym deployu** (B1) — kolumny admina w `do update set`.

Wspólny wzorzec: **objaw pojawia się wyłącznie na wdrożeniu, a przyczyna siedzi w pliku, którego nikt nie uruchamia lokalnie.** Dlatego reguły z tego skilla mają testy, a nie komentarze.

## Dodajesz seed dla nowego modułu

1. `packages/@cortex/db/scripts/seed-<modul>.mjs` — czysty `.mjs`, `DATABASE_URL` z env, idempotentny.
2. Dopisz do `command` usługi `migrate` w **obu** plikach compose, w tej samej pozycji.
3. Rozważ trzecią kopię — `SEED_SCRIPTS` w `e2e/fixtures/db-seed.ts`. Żaden test tego nie sprawdzi, a pominięcie znaczy scenariusz e2e biegnący na innym stanie bazy niż wdrożenie.
4. Uruchom `pnpm test` — `seed-chain-parity.test.ts` złapie rozjazd obu compose'ów, `scripts-parse.test.ts` błąd składni.
5. Sprawdź, czy któraś zapisywana kolumna jest edytowalna z panelu. Jeśli tak — INSERT-only, albo osobny `update ... where activated_at is null`. Uwaga: `seed-tile-manifests-insert-only.test.ts` ma zahardkodowaną nazwę pliku, więc **twojego nowego seeda nie pilnuje nic** — reguła jest na tobie.
6. Aktywacja modułu **nie** należy do jego seeda (obchodzi bramkę licencyjną — `code-license`). `ilustromat`/`token-usage` robią to historycznie i są długiem, nie wzorem.
