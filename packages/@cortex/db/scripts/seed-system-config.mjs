// Seed modułu Konfiguracja Systemu.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... ADMIN_EMAIL=ktos@firma.pl pnpm --filter @cortex/db db:seed
//
// Model: DEKLARACJA STANU DOCELOWEGO, nie jednorazowy bootstrap.
//
//   ADMIN_EMAIL USTAWIONE — przy KAŻDYM uruchomieniu seed zapewnia, że ten
//   DOKŁADNIE jeden adres ma: aktywne konto w `users` (zakłada je, jeśli nie
//   istnieje; REAKTYWUJE, jeśli było wyłączone), rolę `admin` i grant tej roli
//   do `system-config`. Bezwarunkowo. Seed NIE pyta, czy jest już jakiś
//   administrator, i nie zgaduje po kodzie roli — sprawdza tylko ten adres.
//
//   ADMIN_EMAIL NIEUSTAWIONE — seed nie wykonuje tego bloku w ogóle. Nie
//   zakłada konta, nie nadaje roli, niczego nie sprawdza.
//
// Reaktywacja jest ZAMIERZONA, nie backdoorem: nie ma tu ukrytej heurystyki,
// jest jawna deklaracja "ten adres ma zawsze być administratorem", widoczna
// w konfiguracji deployu i pod kontrolą tych samych ludzi, którzy tę
// konfigurację i tak trzymają. To reconciliation loop, nie luka.
//
// ŻEBY TRWALE ODEBRAĆ TEMU KONTU AUTOMATYCZNE PRZYWRACANIE DOSTĘPU, USUŃ
// `ADMIN_EMAIL` Z KONFIGURACJI DEPLOYU (compose/Ansible/.env na serwerze) —
// dezaktywacja albo odebranie roli przez UI zostanie cofnięte przy najbliższym
// uruchomieniu seeda, dopóki ta zmienna tam jest.
//
// Odzyskiwanie ręczne (bez ADMIN_EMAIL): nadanie roli SQL-em działa, ale
// UWAGA — uprawnienia są cache'owane per proces aplikacji na 30 s i SQL tego
// cache'u nie czyści. Po ręcznym nadaniu roli dostęp wraca dopiero po tych do
// 30 s (albo od razu po restarcie procesu); pierwsze żądanie po zmianie nadal
// dostanie 403 i NIE znaczy to, że naprawa nie zadziałała.
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

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

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

    if (!adminEmail) {
      console.log("[seed] ADMIN_EMAIL nieustawione — pomijam deklarację administratora.")
      return
    }

    const [user] = await tx`
      insert into system_config.users (email, full_name, is_active)
      values (${adminEmail}, 'Administrator', true)
      on conflict (email) do update set is_active = true, updated_at = now()
      returning id
    `
    console.log(`[seed] konto ${adminEmail}: aktywne`)

    await tx`
      insert into system_config.user_roles (user_id, role_id)
      values (${user.id}, ${role.id})
      on conflict do nothing
    `
    console.log(`[seed] rola ${ADMIN_ROLE_CODE} -> ${adminEmail}: ok`)

    await tx`
      insert into system_config.permissions_matrix (role_id, application_id)
      values (${role.id}, ${applicationId})
      on conflict do nothing
    `
    console.log(`[seed] grant ${ADMIN_ROLE_CODE} -> ${MODULE_APP_CODE}: ok`)
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
