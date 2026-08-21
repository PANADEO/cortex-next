// Rejestracja idempotentna kafelków natywnych opisanych manifestami
// (@cortex/tile-sdk defineTile()) — PROJECT/cortex-frontend-hub-db-driven-projekt.md
// D10-rewizja (c)/(d), D6-rewizja.
//
// Czysty .mjs (bez kompilacji TS), zero toolchainu — czyta WYŁĄCZNIE gotowy
// tile-manifests.generated.json (wygenerowany w etapie `builder` Dockerfile
// z app/idp/lib/tile-manifests.ts, patrz scripts/generate-tile-manifests.mjs).
// Ten skrypt sam NIE importuje żadnego manifest.ts — to jest dokładnie ten
// mechanizm, który omija brak toolchainu TS i plików app/idp/app/(main)/**
// w obrazie `runner`, z którego startuje usługa `migrate`.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... node packages/@cortex/db/scripts/seed-tile-manifests.mjs
//
// CZĘŚCIOWY upsert, ta sama zasada co seed-system-config.mjs (roles/users):
// `on conflict (code) do update` obejmuje WYŁĄCZNIE kolumny strukturalne
// (kind, route, url, target, updated_at) — fakt kodu, ma prawo wygrywać przy
// każdym deployu, nawet na już aktywowanym wierszu (D10-rewizja d, otwarte
// pytanie g). NIGDY name/description/icon/color/category_functional/
// category_department/is_active/show_on_hub/sort_order — to dane
// instancji/admina, muszą przeżyć deploy.
//
// Na INSERCIE (nowy code, pierwszy deploy z tym manifestem): name = label,
// is_active = false, activated_at = null, a description/icon/color/
// category_functional/category_department/sort_order z manifestu, jeśli go tam
// ktoś podał (K1 z PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/
// cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md, D2/D5 — wcześniej
// te kolumny zawsze zostawały NULL/0 i kafelek manifest-only lądował na hubie
// bez ikony, bez opisu i na pozycji zerowej). Wiersz istnieje, ale jest
// nieaktywny — "kod zarejestrowany, instancja jeszcze nie aktywowała"
// (Krok 3/5, poza zakresem TEGO skryptu).
//
// `show_on_hub` na INSERCIE bierze się z manifestowego `entitlementOnly`
// (K1b): `false` dla czterech kodów, które nie są kafelkami, tylko
// uprawnieniami (`ai-tools`, `cortex-cowork`, oba edytory Intrastatu),
// `true` dla wszystkich pozostałych. Wcześniej było tu zaszyte `false` dla
// każdego, a activateApplication() ustawiała `true` bezwarunkowo — po K3
// (usunięciu APPLICATIONS, gdzie `show_on_hub = excluded.show_on_hub` trzyma
// dziś te cztery poza hubem) pierwsza aktywacja z pickera wystawiłaby je na
// hub jako cztery karty prowadzące do ekranów, które kafelkami nie są.
// `is_active` zostaje `false` dla wszystkich — o tym decyduje aktywacja.
//
// Te siedem pól to WYŁĄCZNIE wartość początkowa, dokładnie na tej samej
// zasadzie co `name` — właścicielem w runtime jest admin edytujący je w UI
// Aplikacje. NIE dopisywać ich do `do update set` niżej: to jest dokładnie ten
// błąd, który seed-system-config.mjs popełniał do K3 (`show_on_hub`, `color`
// i `category_*` bezwarunkowo w UPDATE), przez który kategoria ustawiona w UI
// wracała przy każdym deployu. Lista, która go niosła, zniknęła w `df5d171` —
// i właśnie dlatego ten zakaz jest tu nadal aktualny: to ostatnie miejsce,
// w którym tę pomyłkę dałoby się jeszcze popełnić.
//
// Rozważone i odrzucone: `show_on_hub` w `do update set` pod guardem
// `activated_at is null`. Chodziło o wiersze zarejestrowane PRZED K1b i do
// dziś nieaktywowane — one jedne mają `show_on_hub = false` mimo że są
// prawdziwymi kafelkami, więc po aktywacji nie pokażą się na hubie.
//
// UWAGA, żeby nie zacytować tego kiedyś jako precedensu: guard
// `activated_at is null` NIE jest tą konstrukcją, która zgniła w
// seed-system-config.mjs. Zgniła tam linia BEZWARUNKOWA
// (`show_on_hub = excluded.show_on_hub`, tak samo color/category_*); kolumny
// pod `case when activated_at is null` zachowują się w tamtym pliku
// poprawnie, a seed-ilustromat.mjs i seed-token-usage.mjs używają
// `where ... and activated_at is null` jako przyjętego, działającego wzorca.
//
// Powód odrzucenia jest inny: to nie jest reguła uzgadniania, tylko naprawa
// stanu zastanego, która ma się SKOŃCZYĆ. Seed biegnie przy każdym deployu,
// więc wyjątek wpisany tutaj zostaje na zawsze i trzeba go czytać przy każdej
// kolejnej zmianie tego zapytania; przy okazji zaciemniłby strażnika
// seed-tile-manifests-insert-only.test.ts, który dziś czyta prosto — w
// `do update set` nie ma ANI JEDNEJ kolumny należącej do admina. Backfill
// jedzie więc jednorazową migracją danych, razem z K1b:
// drizzle/system-config/0005_bitter_shadowcat.sql.
//
// TŁUMACZENIA (PROJECT/cortex-frontend/ARTIFACTS/i18n/cortex-frontend-
// tlumaczenia-nazw-kafelkow-projekt.md, rozstrzygnięcie 4): manifest może
// nieść opcjonalne `translations`, wstawiane do system_config.
// application_translations przez "on conflict do nothing" — czyli tą samą
// regułą INSERT-only co `name`. Bez tego dzisiejsze 24 kafelki dostają
// angielskie nazwy z seed-application-translations.mjs, a każdy NASTĘPNY
// kafelek odtwarza problem od zera.
//
// KOLEJNOŚĆ W ŁAŃCUCHU MIGRATE: musi wyprzedzać seed-system-config.mjs — blok
// grantowania admina w tamtym skrypcie ("wszystkie wiersze w applications")
// ma wtedy nadać adminowi grant też do świeżo zarejestrowanych, choć
// nieaktywnych, kodów.

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const manifestsFile = path.join(__dirname, "tile-manifests.generated.json")

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed:tile-manifests] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

let manifests
try {
  const raw = await fs.readFile(manifestsFile, "utf8")
  manifests = JSON.parse(raw)
} catch (error) {
  console.error(
    `[seed:tile-manifests] nie mogę odczytać ${manifestsFile} — czy etap builder Dockerfile ` +
      "uruchomił scripts/generate-tile-manifests.mjs? (PROJECT/cortex-frontend-hub-db-driven-projekt.md D10-rewizja c)",
  )
  console.error(error)
  process.exit(1)
}

if (!Array.isArray(manifests) || manifests.length === 0) {
  console.error("[seed:tile-manifests] tile-manifests.generated.json jest puste albo nie jest tablicą.")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    let inserted = 0
    let translationsInserted = 0
    for (const manifest of manifests) {
      const [row] = await tx`
        insert into system_config.applications
          (code, name, kind, route, url, target, is_active, show_on_hub, activated_at,
           description, icon, color, category_functional, category_department, sort_order)
        values (
          ${manifest.entitlementCode}, ${manifest.label}, ${manifest.kind},
          ${manifest.route ?? null}, ${manifest.url ?? null}, ${manifest.target ?? null},
          -- is_active, show_on_hub, activated_at. Jawne porównanie z true, a
          -- nie negacja: kierunkiem domyślnym jest "to jest kafelek", więc
          -- cokolwiek innego niż dokładnie true (pole pominięte, ręcznie
          -- zepsuty JSON) ma wystawić kartę, nie ukryć ją po cichu.
          -- UWAGA: bez odwrotnych apostrofów w tych komentarzach — całe
          -- zapytanie jest template literalem JS (patrz scripts-parse.test.ts).
          false, ${manifest.entitlementOnly !== true}, null,
          ${manifest.description ?? null}, ${manifest.icon ?? null}, ${manifest.color ?? null},
          ${manifest.categoryFunctional ?? null}, ${manifest.categoryDepartment ?? null},
          -- sort_order jest NOT NULL DEFAULT 0, więc tu leci 0, a nie null:
          -- manifest bez tego pola ma dać dokładnie to, co dała by domyślna
          -- wartość kolumny.
          ${manifest.sortOrder ?? 0}
        )
        -- Częściowy upsert: WYŁĄCZNIE kolumny strukturalne. name/description/
        -- icon/color/is_active/show_on_hub/category_functional/
        -- category_department/sort_order NIE są tu — zmiany zrobione w UI
        -- (Krok 3+) i stan aktywacji (Krok 1b punkt d, poza zakresem tego
        -- skryptu) przeżywają deploy. Pola prezentacyjne z manifestu są więc
        -- wartością POCZĄTKOWĄ wiersza, nie deklaracją stanu docelowego —
        -- patrz nagłówek pliku. is_active=false i show_on_hub z manifestu
        -- WYŁĄCZNIE na INSERCIE (nowy code) — na UPDATE (kod już istnieje) te
        -- dwie kolumny NIE są w SET, więc już aktywowany/wyłączony przez
        -- admina wiersz zostaje bez zmian.
        on conflict (code) do update set
          kind = excluded.kind,
          route = excluded.route,
          url = excluded.url,
          target = excluded.target,
          updated_at = now()
        returning id, (xmax = 0) as inserted
      `
      if (row?.inserted) inserted += 1

      // Tłumaczenia z manifestu (defineTile({ translations })) — TĄ SAMĄ
      // REGUŁĄ INSERT-ONLY co pola prezentacyjne wyżej, tyle że wyrażoną
      // wprost przez "on conflict do nothing": wartość początkowa pochodzi z
      // kodu, właścicielem w runtime jest admin edytujący ją w oknie
      // Tłumaczenia. Bez tego bloku rozwiązalibyśmy problem dla dzisiejszych
      // kafelków (seed-application-translations.mjs) i odtworzyli go dla
      // każdego następnego.
      //
      // Osobny INSERT, a nie kolumna w upsercie wyżej: to inna tabela i inna
      // ziarnistość (jeden kafelek ma po wierszu na język).
      for (const [locale, translation] of Object.entries(manifest.translations ?? {})) {
        const name = translation?.name ?? null
        const description = translation?.description ?? null
        // Wpis bez ani jednej wartości nie jest tłumaczeniem — nie ma powodu
        // zakładać dla niego wiersza (ta sama reguła, którą stosuje zapis z
        // panelu: wiersz bez wartości jest kasowany).
        if (name === null && description === null) continue
        await tx`
          insert into system_config.application_translations
            (application_id, locale, name, description)
          values (${row.id}, ${locale}, ${name}, ${description})
          on conflict (application_id, locale) do nothing
        `
        translationsInserted += 1
      }
    }
    console.log(
      `[seed:tile-manifests] rejestr manifestów: ${manifests.length} kodów, dopisano ${inserted} nowych ` +
        `(pozostałe: sync kind/route/url/target z kodu), tłumaczeń z manifestów: ${translationsInserted}`,
    )
  })
}

try {
  await main()
  console.log("[seed:tile-manifests] zakończono.")
} catch (error) {
  console.error("[seed:tile-manifests] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
