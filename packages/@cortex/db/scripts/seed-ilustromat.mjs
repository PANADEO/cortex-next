// Seed modułu Ilustromat: dwa domyślne szablony marki + rejestracja kafelka
// i jego scope'u granularnego.
//
// IDEMPOTENTNY — wolno uruchamiać przy każdym deployu:
//   DATABASE_URL=... pnpm --filter @cortex/db db:seed:ilustromat
//
// Szablony `crido-violet` i `crido-light` mają wartości IDENTYCZNE z
// _seed_defaults() w core/templates.py (dawne stałe COLOR_VIOLET/"light"),
// żeby port nie zmienił wyglądu kafelków, które klient już widział:
//   violet: bg (91,61,168)=#5B3DA8, text (255,255,255)=#FFFFFF, accent (255,140,66)=#FF8C42
//   light:  bg #FFFFFF,             text (61,38,122)=#3D267A,  accent #FF8C42
//
// Font: Noto Sans z biblioteki (OFL). Prawdziwe assety brandowe Crido (plik
// fontu z licencją, logo, dokładne HEX-y) są nadal niedostępne — placeholder
// jest tu ŚWIADOMY i odziedziczony wprost z PoC, nie przypadkowy.

import postgres from "postgres"

const APP_CODE = "ilustromat"
const MANAGE_TEMPLATES_SCOPE = "manage-templates"
const ADMIN_ROLE_CODE = "admin"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed:ilustromat] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const TEMPLATES = [
  {
    id: "crido-violet",
    name: "Crido — fioletowa (domyślna)",
    color_bg: "#5B3DA8",
    color_text: "#FFFFFF",
    color_accent: "#FF8C42",
    website_text: "crido.pl",
  },
  {
    id: "crido-light",
    name: "Crido — jasna",
    color_bg: "#FFFFFF",
    color_text: "#3D267A",
    color_accent: "#FF8C42",
    website_text: "crido.pl",
  },
]

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    for (const template of TEMPLATES) {
      await tx`
        insert into ilustromat.frame_templates
          (id, name, color_bg, color_text, color_accent, font_source, font_library_id,
           logo_position, corner_radius, min_image_area_ratio, website_text,
           layout, text_align, is_active, created_by)
        values (
          ${template.id}, ${template.name}, ${template.color_bg}, ${template.color_text},
          ${template.color_accent}, 'library', 'noto-sans', 'bottom-right', 28, 0.45,
          ${template.website_text}, 'image-top', 'left', true, 'system'
        )
        on conflict (id) do nothing
      `
      console.log(`[seed:ilustromat] szablon ${template.id}: ok`)
    }

    // Rejestr kafelków: wiersz w applications istnieje już dzięki
    // seed-tile-manifests.mjs (wcześniej w łańcuchu migrate — manifest
    // ilustromatTile w app/idp/app/(main)/ilustromat/manifest.ts). Ten skrypt
    // WYŁĄCZNIE go odczytuje, nie tworzy — druga, insertująca ścieżka do tego
    // samego wiersza była redundantna po dodaniu seed-tile-manifests.mjs
    // (PROJECT/cortex-frontend-hub-db-driven-projekt.md D10-rewizja c,
    // otwarte pytanie f).
    const [application] = await tx`
      select id from system_config.applications where code = ${APP_CODE}
    `
    // Twardy błąd, nie ostrzeżenie — ta sama logika co brak roli admin niżej:
    // cichy exit 0 dałby granty do wiersza, który nigdy nie powstał.
    if (!application) {
      throw new Error(
        "[seed:ilustromat] brak wiersza applications dla 'ilustromat' — uruchom najpierw seed-tile-manifests.mjs (kolejność seedów w docker-compose.yml).",
      )
    }
    const applicationId = application.id
    console.log(`[seed:ilustromat] aplikacja ${APP_CODE}: ok`)

    // Ilustromat jest już DZIŚ realnym, działającym modułem — dokładnie jak
    // 22 wiersze zmigrowane w Kroku 1 (D6-rewizja: "Migrowanych ~24
    // dzisiejszych natywnych wierszy — plus ilustromat/token-usage
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
    // (Krok 1 dotknął tylko kodów z seed-system-config.mjs — ilustromat/
    // token-usage mają WŁASNE seedy właśnie dlatego, patrz komentarz wyżej —
    // bez tego dopełnienia tu kafelek renderowałby się na hubie (Krok 3)
    // z neutralnym kolorem zamiast fioletowego i bez zakładki kategorii,
    // mimo że statyczny TILES miał obie wartości od zawsze).
    await tx`
      update system_config.applications
      set is_active = true, show_on_hub = true, activated_at = now(),
          color = 'violet', category_functional = 'content-generation',
          category_department = array['marketing']
      where id = ${applicationId} and activated_at is null
    `

    // Warstwa GRANULARNA: scope decydujący, kto widzi "Szablony marki".
    // Ilustromat jest pierwszym realnym konsumentem tych tabel.
    const [scope] = await tx`
      insert into system_config.application_scopes (application_id, code, name)
      values (${applicationId}, ${MANAGE_TEMPLATES_SCOPE}, 'Zarządzanie szablonami marki')
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
    console.log(`[seed:ilustromat] scope ${MANAGE_TEMPLATES_SCOPE}: ok`)

    const [adminRole] = await tx`
      select id from system_config.roles where code = ${ADMIN_ROLE_CODE}
    `
    // Twardy błąd, nie ostrzeżenie — uzasadnienie identyczne jak w
    // seed-token-usage.mjs: exit 0 przy braku roli dawał zarejestrowany kafelek,
    // do którego nikt nie ma dostępu, a `migrate` mimo to przechodził.
    if (!adminRole) {
      throw new Error(
        "[seed:ilustromat] brak roli admin — uruchom najpierw seed-system-config.mjs (kolejność seedów w docker-compose.yml).",
      )
    }

    await tx`
      insert into system_config.permissions_matrix (role_id, application_id)
      values (${adminRole.id}, ${applicationId})
      on conflict do nothing
    `
    await tx`
      insert into system_config.role_application_scopes (role_id, application_scope_id)
      values (${adminRole.id}, ${scopeId})
      on conflict do nothing
    `
    console.log(`[seed:ilustromat] granty dla roli ${ADMIN_ROLE_CODE}: ok`)
  })
}

try {
  await main()
  console.log("[seed:ilustromat] zakończono.")
} catch (error) {
  console.error("[seed:ilustromat] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
