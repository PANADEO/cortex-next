import { defineConfig } from "drizzle-kit"

// Jedna baza Postgres, schema-per-moduł — patrz docs/database.md.
// Każdy moduł dostaje WŁASNY plik w src/schema/<modul>.ts i WŁASNY
// migrationsSchema (patrz code-db/REFERENCE.md — kolizja domyślnej
// tabeli migracji Drizzle przy wielu schematach w jednym repo).
export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
