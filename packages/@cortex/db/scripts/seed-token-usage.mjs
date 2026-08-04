// Seed kafelka "Raportowanie Tokenów": WYŁĄCZNIE rejestracja w rejestrze
// kafelków i grant dla roli administracyjnej.
//
// Ten moduł nie ma własnego schematu, tabeli ani migracji i mieć nie będzie —
// to czysty widok read-only nad danymi cortex-proxy (SQLite w tamtym
// kontenerze). Jedyne wiersze, jakie tu powstają, to dane RBAC, nie dane modułu.
// Dlatego nie ma db:generate:token-usage ani db:migrate:token-usage.
//
// IDEMPOTENTNY — wolno uruchamiać przy każdym deployu:
//   DATABASE_URL=... pnpm --filter @cortex/db db:seed:token-usage
//
// GRANT DOSTAJE TYLKO ROLA ADMINISTRACYJNA. To nie jest ostrożnościowa
// domyślna wartość do poluzowania przy okazji: za tym kafelkiem leży lista
// e-maili wszystkich użytkowników instancji wraz z ich aktywnością — kto,
// kiedy, jakim modelem i w jakim narzędziu pracował.

import postgres from "postgres"

const APP_CODE = "token-usage"
const ADMIN_ROLE_CODE = "admin"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed:token-usage] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    // Rejestr kafelków: wiersz w applications istnieje już dzięki
    // seed-tile-manifests.mjs (wcześniej w łańcuchu migrate — manifest
    // tokenUsageTile w app/idp/app/(main)/token-usage/manifest.ts). Ten
    // skrypt WYŁĄCZNIE go odczytuje, nie tworzy — druga, insertująca ścieżka
    // do tego samego wiersza była redundantna po dodaniu
    // seed-tile-manifests.mjs (PROJECT/cortex-frontend-hub-db-driven-projekt.md
    // D10-rewizja c, otwarte pytanie f).
    const [application] = await tx`
      select id from system_config.applications where code = ${APP_CODE}
    `
    if (!application) {
      throw new Error(
        "[seed:token-usage] brak wiersza applications dla 'token-usage' — uruchom najpierw seed-tile-manifests.mjs (kolejność seedów w docker-compose.yml).",
      )
    }
    const applicationId = application.id
    console.log(`[seed:token-usage] aplikacja ${APP_CODE}: ok`)

    // Raportowanie Tokenów jest już DZIŚ realnym, działającym modułem —
    // dokładnie jak 22 wiersze zmigrowane w Kroku 1 (D6-rewizja: "Migrowanych
    // ~24 dzisiejszych natywnych wierszy — plus ilustromat/token-usage
    // rejestrowane poza seed-system-config.mjs — dostaje przy migracji
    // activated_at = now()"). Jeśli to pierwszy deploy z manifestem na tej
    // instancji, seed-tile-manifests.mjs (wcześniej w łańcuchu) właśnie
    // stworzył ten wiersz jako NIEAKTYWNEGO kandydata (is_active=false,
    // show_on_hub=false, activated_at=null — słuszny domyślny stan dla
    // NOWYCH modułów, ale nie dla tego, który już działa). Cofamy to tutaj.
    // Guard na activated_at IS NULL: nie cofa świadomej dezaktywacji admina
    // po pierwszej aktywacji.
    //
    // color/category_functional/category_department 1:1 z app/idp/lib/tiles.ts
    // (Krok 1 dotknął tylko kodów z seed-system-config.mjs — token-usage ma
    // WŁASNY seed właśnie dlatego, patrz komentarz wyżej — bez tego
    // dopełnienia kafelek renderowałby się na hubie (Krok 3) z neutralnym
    // kolorem zamiast błękitnego i bez zakładki kategorii, mimo że statyczny
    // TILES miał obie wartości od zawsze). `description` dołączona tym samym
    // mechanizmem (bug zgłoszony po demo: karta na hubie renderowała się bez
    // opisu — system_config.applications.description jest realną, nullable
    // kolumną, którą tile-card.tsx renderuje bezwarunkowo; ten UPDATE nigdy
    // jej nie ustawiał).
    await tx`
      update system_config.applications
      set is_active = true, show_on_hub = true, activated_at = now(),
          color = 'sky', category_functional = 'admin-system',
          category_department = array['it'],
          description = 'Zużycie tokenów AI według użytkowników, modeli i narzędzi'
      where id = ${applicationId} and activated_at is null
    `

    const [adminRole] = await tx`
      select id from system_config.roles where code = ${ADMIN_ROLE_CODE}
    `
    // Twardy błąd, nie ostrzeżenie. Do 30.07.2026 ta gałąź logowała i kończyła
    // się exit 0: usługa `migrate` przechodziła, aplikacja wstawała, kafelek był
    // w rejestrze — i nikt nie miał do niego dostępu. Jedynym śladem była linijka
    // w logu kontenera, który się już zakończył. Rzucenie wyjątku wycofuje też
    // transakcję, więc rejestracja kafelka nie zostaje bez grantu.
    if (!adminRole) {
      throw new Error(
        "[seed:token-usage] brak roli admin — uruchom najpierw seed-system-config.mjs (kolejność seedów w docker-compose.yml).",
      )
    }

    await tx`
      insert into system_config.permissions_matrix (role_id, application_id)
      values (${adminRole.id}, ${applicationId})
      on conflict do nothing
    `
    console.log(`[seed:token-usage] grant dla roli ${ADMIN_ROLE_CODE}: ok`)
  })
}

try {
  await main()
  console.log("[seed:token-usage] zakończono.")
} catch (error) {
  console.error("[seed:token-usage] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
