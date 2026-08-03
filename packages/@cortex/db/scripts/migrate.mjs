// Migracje jako KROK DEPLOYU, nie krok developerski.
//
//   DATABASE_URL=... node packages/@cortex/db/scripts/migrate.mjs
//   (albo: pnpm --filter @cortex/db db:migrate:apply)
//
// Po co osobno od `db:migrate` (drizzle-kit): drizzle-kit jest devDependency
// i nie ma go w obrazie produkcyjnym. Ten skrypt używa migratora z
// drizzle-orm, czyli zależności RUNTIME'owej, więc działa w kontenerze jednym
// `node`, bez toolchainu build — dokładnie z tego samego powodu, dla którego
// seedy są w .mjs.
//
// Stosuje migracje WSZYSTKICH modułów, w kolejności z listy niżej. Każdy moduł
// ma własny folder migracji i własną tabelę stanu w osobnym schemacie
// `<moduł>_migrations` — bez tego drugi moduł po cichu pomija swoje migracje,
// bo współdzielona tabela `drizzle.__drizzle_migrations` "już istnieje"
// (pułapka opisana w drizzle.system-config.config.ts). Wartości MUSZĄ się
// zgadzać z odpowiadającymi plikami drizzle.*.config.ts — rozjazd oznacza
// ciche pominięcie migracji, nie błąd.
//
// Idempotentny: migrator pomija migracje już odnotowane w tabeli stanu.

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import path from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const MODULES = [
  {
    name: "system-config",
    folder: "drizzle/system-config",
    migrationsSchema: "system_config_migrations",
    migrationsTable: "__drizzle_migrations",
  },
  {
    name: "ilustromat",
    folder: "drizzle/ilustromat",
    migrationsSchema: "ilustromat_migrations",
    migrationsTable: "__drizzle_migrations",
  },
  {
    name: "geo-score-calculator",
    folder: "drizzle/geo-score-calculator",
    migrationsSchema: "geo_score_calculator_migrations",
    migrationsTable: "__drizzle_migrations",
  },
  {
    name: "document-parser",
    folder: "drizzle/document-parser",
    migrationsSchema: "document_parser_migrations",
    migrationsTable: "__drizzle_migrations",
  },
  {
    name: "content-guru",
    folder: "drizzle/content-guru",
    migrationsSchema: "content_guru_migrations",
    migrationsTable: "__drizzle_migrations",
  },
  {
    name: "visual-guru",
    folder: "drizzle/visual-guru",
    migrationsSchema: "visual_guru_migrations",
    migrationsTable: "__drizzle_migrations",
  },
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

// max: 1 — migracje idą sekwencyjnie, jedno połączenie wystarcza i nie zostawia
// wiszących socketów po zakończeniu kroku deployu.
const sql = postgres(databaseUrl, { max: 1 })
const db = drizzle(sql)

try {
  for (const module of MODULES) {
    await migrate(db, {
      migrationsFolder: path.join(packageRoot, module.folder),
      migrationsSchema: module.migrationsSchema,
      migrationsTable: module.migrationsTable,
    })
    console.log(`[migrate] ${module.name}: ok`)
  }
  console.log("[migrate] zakończono.")
} catch (error) {
  console.error("[migrate] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
