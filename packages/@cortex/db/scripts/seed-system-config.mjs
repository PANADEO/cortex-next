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
// Zasada bezpieczeństwa (RZECZYWISTE zachowanie, nie życzeniowe): seed dotyka
// użytkownika z BOOTSTRAP_ADMIN_EMAIL WYŁĄCZNIE wtedy, gdy w tabeli `users` nie
// ma jeszcze ŻADNEGO wiersza z tym adresem. Istniejący wiersz — nieważne czy
// aktywny, czy z rolą admina, czy bez — jest nietykalny: seed go nie
// reaktywuje i nie przywraca mu roli.
//
// Dzięki temu świadoma dezaktywacja konta albo odebranie roli przez UI jest
// TRWAŁA i nie cofa jej kolejny redeploy. Wcześniejsza wersja robiła
// `on conflict (email) do update set is_active = true`, czyli działała jak
// trwały backdoor — dokładnie wbrew temu, co deklarował ten komentarz.
//
// Dodatkowo, jeśli w systemie jest już JAKIKOLWIEK inny aktywny administrator,
// seed nie zakłada kolejnego — nowych adminów nadaje się przez UI, nie przez
// zmienną środowiskową.
//
// Wyjście awaryjne po utracie wszystkich adminów jest świadomie ręczne: trzeba
// usunąć wiersz użytkownika w bazie (albo nadać rolę SQL-em) — operacja
// wymagająca dostępu do Postgresa, nie samej zmiennej w deployu.
//
// Czysty .mjs (bez kompilacji TS) — ma działać jako krok deployu jednym
// `node`, bez toolchainu build.

import postgres from "postgres"

const ADMIN_ROLE_CODE = "admin"
const MODULE_APP_CODE = "system-config"

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
      insert into system_config.roles (code, name, description, is_system)
      values (${ADMIN_ROLE_CODE}, 'Administrator', 'Pełny dostęp do konfiguracji systemu', true)
      on conflict (code) do update set is_system = true
      returning id
    `
    console.log(`[seed] rola ${ADMIN_ROLE_CODE}: ok`)

    const [application] = await tx`
      insert into system_config.applications
        (code, name, description, icon, category, kind, route, sort_order)
      values (
        ${MODULE_APP_CODE}, 'Konfiguracja Systemu',
        'Użytkownicy, role, uprawnienia i aplikacje instancji', 'Settings',
        'Administracja', 'native', '/system-config', 100
      )
      on conflict (code) do nothing
      returning id
    `
    const applicationId =
      application?.id ??
      (
        await tx`select id from system_config.applications where code = ${MODULE_APP_CODE}`
      )[0].id
    console.log(`[seed] aplikacja ${MODULE_APP_CODE}: ok`)

    await tx`
      insert into system_config.permissions_matrix (role_id, application_id)
      values (${role.id}, ${applicationId})
      on conflict do nothing
    `
    console.log(`[seed] grant ${ADMIN_ROLE_CODE} -> ${MODULE_APP_CODE}: ok`)

    if (!bootstrapEmail) {
      console.log("[seed] BOOTSTRAP_ADMIN_EMAIL nieustawione — pomijam zakładanie administratora.")
      return
    }

    // Kluczowy warunek: liczy się SAMO ISTNIENIE wiersza, nie to czy jest
    // aktywny ani czy ma rolę. Konto raz założone przechodzi pod zarząd UI.
    const [alreadySeeded] = await tx`
      select is_active from system_config.users where email = ${bootstrapEmail}
    `

    if (alreadySeeded) {
      console.log(
        `[seed] użytkownik ${bootstrapEmail} już istnieje (aktywny: ${alreadySeeded.is_active}) — nie dotykam go.`,
      )
      return
    }

    const [existingAdmin] = await tx`
      select u.email
      from system_config.users u
      join system_config.user_roles ur on ur.user_id = u.id
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
      insert into system_config.users (email, full_name)
      values (${bootstrapEmail}, 'Bootstrap Administrator')
      on conflict (email) do nothing
      returning id
    `

    if (!user) {
      console.log(`[seed] użytkownik ${bootstrapEmail} powstał równolegle — nie dotykam go.`)
      return
    }

    await tx`
      insert into system_config.user_roles (user_id, role_id)
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
