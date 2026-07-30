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
    const [application] = await tx`
      insert into system_config.applications
        (code, name, description, icon, category, kind, route, sort_order)
      values (
        ${APP_CODE}, 'Raportowanie Tokenów',
        'Zużycie tokenów i liczba żądań przechodzących przez cortex-proxy', 'BarChart3',
        'Administracja', 'native', '/token-usage', 120
      )
      on conflict (code) do nothing
      returning id
    `
    const applicationId =
      application?.id ??
      (await tx`select id from system_config.applications where code = ${APP_CODE}`)[0].id
    console.log(`[seed:token-usage] aplikacja ${APP_CODE}: ok`)

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
