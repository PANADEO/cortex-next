import { defineConfig } from "drizzle-kit"

// Config modułu GEO Score Calculator. Osobny plik, osobny `out`, osobny
// schemat tabeli migracji — patrz drizzle.ilustromat.config.ts (ten sam
// wzorzec, skopiowany 1:1) i code-db/REFERENCE.md dla obu pułapek
// udokumentowanych tam już raz:
//  1. Płaskie `migrationsSchema` na najwyższym poziomie jest w drizzle-kit
//     0.28.x po cichu IGNOROWANE — poprawna jest forma zagnieżdżona
//     `migrations: { schema, table }`.
//  2. Schemat tabeli migracji MUSI być inny niż schemat modułu.
export default defineConfig({
  schema: "./src/schema/geo-score-calculator.ts",
  out: "./drizzle/geo-score-calculator",
  dialect: "postgresql",
  migrations: {
    schema: "geo_score_calculator_migrations",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
