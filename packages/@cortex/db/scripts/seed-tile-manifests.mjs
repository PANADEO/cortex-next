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
// pytanie g). NIGDY name/icon/is_active/sort_order — to dane
// instancji/admina, muszą przeżyć deploy.
//
// Na INSERCIE (nowy code, pierwszy deploy z tym manifestem): name = label,
// is_active = false, show_on_hub = false, activated_at = null,
// icon/category_functional/category_department = null. Wiersz
// istnieje, ale jest nieaktywny — "kod zarejestrowany, instancja jeszcze nie
// aktywowała" (Krok 3/5, poza zakresem TEGO skryptu).
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
    for (const manifest of manifests) {
      const [row] = await tx`
        insert into system_config.applications
          (code, name, kind, route, url, target, is_active, show_on_hub, activated_at)
        values (
          ${manifest.entitlementCode}, ${manifest.label}, ${manifest.kind},
          ${manifest.route ?? null}, ${manifest.url ?? null}, ${manifest.target ?? null},
          false, false, null
        )
        -- Częściowy upsert: WYŁĄCZNIE kolumny strukturalne. name/icon/
        -- is_active/show_on_hub/category_functional/category_department/
        -- sort_order NIE są tu — zmiany zrobione w UI (Krok 3+) i stan
        -- aktywacji (Krok 1b punkt d, poza zakresem tego skryptu) przeżywają
        -- deploy. is_active/show_on_hub=false WYŁĄCZNIE na INSERCIE (nowy
        -- code) — na UPDATE (kod już istnieje) te dwie kolumny NIE są w SET,
        -- więc już aktywowany/wyłączony przez admina wiersz zostaje bez zmian.
        on conflict (code) do update set
          kind = excluded.kind,
          route = excluded.route,
          url = excluded.url,
          target = excluded.target,
          updated_at = now()
        returning id, (xmax = 0) as inserted
      `
      if (row?.inserted) inserted += 1
    }
    console.log(
      `[seed:tile-manifests] rejestr manifestów: ${manifests.length} kodów, dopisano ${inserted} nowych ` +
        "(pozostałe: sync kind/route/url/target z kodu)",
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
