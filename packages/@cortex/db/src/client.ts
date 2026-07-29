// Połączenie z jedyną instancją Postgresa (docs/database.md).
// Leniwe: sam import pakietu nie wymaga DATABASE_URL, żeby build/testy
// niezwiązane z bazą nie wywracały się na braku zmiennej.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/system-config"

export type CortexDatabase = PostgresJsDatabase<typeof schema>

type Sql = ReturnType<typeof postgres>

let sql: Sql | undefined
let database: CortexDatabase | undefined

export function getDb(): CortexDatabase {
  if (database) return database

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL nie jest ustawione — @cortex/db nie ma się z czym połączyć. " +
        "Lokalnie: docker compose up postgres (patrz docker-compose.yml).",
    )
  }

  sql = postgres(url, { max: 5 })
  database = drizzle(sql, { schema })
  return database
}

export async function closeDb(): Promise<void> {
  await sql?.end()
  sql = undefined
  database = undefined
}
