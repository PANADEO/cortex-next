// Seed modułu Content Guru — Round B: rejestruje WYŁĄCZNIE scope granularny
// `manage-templates` (design doc D6/D9, PROJECT/cortex-frontend-content-
// guru-full-port-projekt.md) i grantuje go roli `admin`. W odróżnieniu od
// seed-ilustromat.mjs: `content-guru` app JUŻ istnieje i jest AKTYWNA
// (seed-system-config.mjs, code: "content-guru") — kafelek żył na demo-dev
// od dawna jako AI Tools narzędzie, więc nie ma tu żadnej logiki
// aktywacji/wiersza `applications` do dotknięcia, wyłącznie scope.
//
// IDEMPOTENTNY — wolno uruchamiać przy każdym deployu:
//   DATABASE_URL=... pnpm --filter @cortex/db db:seed:content-guru

import postgres from "postgres"

const APP_CODE = "content-guru"
const MANAGE_TEMPLATES_SCOPE = "manage-templates"
const ADMIN_ROLE_CODE = "admin"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed:content-guru] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    const [application] = await tx`
      select id from system_config.applications where code = ${APP_CODE}
    `
    // Twardy błąd, nie ostrzeżenie — ta sama logika co seed-ilustromat.mjs:
    // cichy exit 0 dałby scope bez wiersza aplikacji, do którego się odnosi.
    if (!application) {
      throw new Error(
        "[seed:content-guru] brak wiersza applications dla 'content-guru' — uruchom najpierw seed-system-config.mjs (kolejność seedów w docker-compose.yml).",
      )
    }
    const applicationId = application.id
    console.log(`[seed:content-guru] aplikacja ${APP_CODE}: ok`)

    const [scope] = await tx`
      insert into system_config.application_scopes (application_id, code, name)
      values (${applicationId}, ${MANAGE_TEMPLATES_SCOPE}, 'Zarządzanie szablonami')
      on conflict (application_id, code) do nothing
      returning id
    `
    const scopeId =
      scope?.id ??
      (
        await tx`
          select id from system_config.application_scopes
          where application_id = ${applicationId} and code = ${MANAGE_TEMPLATES_SCOPE}
        `
      )[0].id
    console.log(`[seed:content-guru] scope ${MANAGE_TEMPLATES_SCOPE}: ok`)

    const [adminRole] = await tx`
      select id from system_config.roles where code = ${ADMIN_ROLE_CODE}
    `
    if (!adminRole) {
      throw new Error(
        "[seed:content-guru] brak roli admin — uruchom najpierw seed-system-config.mjs (kolejność seedów w docker-compose.yml).",
      )
    }

    // permissions_matrix (grant do samego kafelka) dla roli admin już istnieje
    // — seed-system-config.mjs grantuje roli admin WSZYSTKIE wiersze
    // `applications` bez warunku na is_active/activated_at. Tu tylko scope.
    await tx`
      insert into system_config.role_application_scopes (role_id, application_scope_id)
      values (${adminRole.id}, ${scopeId})
      on conflict do nothing
    `
    console.log(`[seed:content-guru] granty scope'u dla roli ${ADMIN_ROLE_CODE}: ok`)
  })
}

try {
  await main()
  console.log("[seed:content-guru] zakończono.")
} catch (error) {
  console.error("[seed:content-guru] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
