import { defineConfig } from "drizzle-kit"

// Config modułu Parser Dokumentów. Osobny plik, osobny `out`, osobny
// schemat tabeli migracji — patrz code-db/REFERENCE.md i
// drizzle.ilustromat.config.ts (ten sam wzorzec, ta sama para pułapek
// drizzle-kit 0.28.x opisana tam: płaskie `migrationsSchema` jest po cichu
// ignorowane, a schemat tabeli migracji musi być inny niż schemat modułu).
export default defineConfig({
  schema: "./src/schema/document-parser.ts",
  out: "./drizzle/document-parser",
  dialect: "postgresql",
  migrations: {
    schema: "document_parser_migrations",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
