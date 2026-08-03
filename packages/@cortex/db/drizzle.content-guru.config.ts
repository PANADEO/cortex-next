import { defineConfig } from "drizzle-kit"

// Config modułu Content Guru. Osobny plik, osobny `out`, osobny schemat
// tabeli migracji — patrz drizzle.ilustromat.config.ts (ten sam wzorzec,
// skopiowany 1:1) i code-db/REFERENCE.md dla obu pułapek udokumentowanych
// tam już raz:
//  1. Płaskie `migrationsSchema` na najwyższym poziomie jest w drizzle-kit
//     0.28.x po cichu IGNOROWANE — poprawna jest forma zagnieżdżona
//     `migrations: { schema, table }`.
//  2. Schemat tabeli migracji MUSI być inny niż schemat modułu.
export default defineConfig({
  schema: "./src/schema/content-guru.ts",
  out: "./drizzle/content-guru",
  dialect: "postgresql",
  migrations: {
    schema: "content_guru_migrations",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
