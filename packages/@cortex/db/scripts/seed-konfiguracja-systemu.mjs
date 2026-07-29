// Seed bootstrapowy modułu Konfiguracja Systemu.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... BOOTSTRAP_ADMIN_EMAIL=ktos@firma.pl pnpm --filter @cortex/db db:seed
//
// Rozwiązuje problem "jajko i kura": pusta baza => nikt nie ma grantu => nikt
// nie wejdzie do Konfiguracji Systemu, żeby nadać pierwszy grant. Dlatego
// bootstrap idzie przez środowisko (docker-compose/.env), a NIE przez stanową
// logikę w runtime aplikacji.
//
// Zasada bezpieczeństwa: administrator jest zakładany TYLKO gdy w systemie nie
// ma jeszcze ŻADNEGO aktywnego admina. Ustawiona zmienna nie jest więc trwałym
// backdoorem — po pierwszym uruchomieniu staje się nieaktywna.
//
// Czysty .mjs (bez kompilacji TS) — ma działać jako krok deployu jednym
// `node`, bez toolchainu build.

import postgres from "postgres"

const ADMIN_ROLE_CODE = "admin"
const MODULE_APP_CODE = "konfiguracja-systemu"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    const [role] = await tx`
      insert into konfiguracja_systemu.roles (code, name, description, is_system)
      values (${ADMIN_ROLE_CODE}, 'Administrator', 'Pełny dostęp do konfiguracji systemu', true)
      on conflict (code) do update set is_system = true
      returning id
    `
    console.log(`[seed] rola ${ADMIN_ROLE_CODE}: ok`)

    const [application] = await tx`
      insert into konfiguracja_systemu.applications
        (code, name, description, icon, category, kind, route, sort_order)
      values (
        ${MODULE_APP_CODE}, 'Konfiguracja Systemu',
        'Użytkownicy, role, uprawnienia i rejestr kafelków', 'Settings',
        'Administracja', 'native', '/konfiguracja-systemu', 100
      )
      on conflict (code) do nothing
      returning id
    `
    const applicationId =
      application?.id ??
      (
        await tx`select id from konfiguracja_systemu.applications where code = ${MODULE_APP_CODE}`
      )[0].id
    console.log(`[seed] aplikacja ${MODULE_APP_CODE}: ok`)

    await tx`
      insert into konfiguracja_systemu.permissions_matrix (role_id, application_id)
      values (${role.id}, ${applicationId})
      on conflict do nothing
    `
    console.log(`[seed] grant ${ADMIN_ROLE_CODE} -> ${MODULE_APP_CODE}: ok`)

    if (!bootstrapEmail) {
      console.log("[seed] BOOTSTRAP_ADMIN_EMAIL nieustawione — pomijam zakładanie administratora.")
      return
    }

    const [existingAdmin] = await tx`
      select u.email
      from konfiguracja_systemu.users u
      join konfiguracja_systemu.user_roles ur on ur.user_id = u.id
      where ur.role_id = ${role.id} and u.is_active = true
      limit 1
    `

    if (existingAdmin) {
      console.log(
        `[seed] administrator już istnieje (${existingAdmin.email}) — nie zakładam kolejnego.`,
      )
      return
    }

    const [user] = await tx`
      insert into konfiguracja_systemu.users (email, full_name)
      values (${bootstrapEmail}, 'Bootstrap Administrator')
      on conflict (email) do update set is_active = true
      returning id
    `

    await tx`
      insert into konfiguracja_systemu.user_roles (user_id, role_id)
      values (${user.id}, ${role.id})
      on conflict do nothing
    `
    console.log(`[seed] założono administratora: ${bootstrapEmail}`)
  })
}

try {
  await main()
  console.log("[seed] zakończono.")
} catch (error) {
  console.error("[seed] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
