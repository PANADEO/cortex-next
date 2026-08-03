import { defineConfig } from "drizzle-kit"

// Config modułu Visual Guru. Osobny plik, osobny `out`, osobny schemat tabeli
// migracji — patrz code-db/REFERENCE.md i drizzle.ilustromat.config.ts (ten
// sam wzorzec, ta sama para pułapek drizzle-kit 0.28.x opisana tam: płaskie
// `migrationsSchema` jest po cichu ignorowane, a schemat tabeli migracji musi
// być inny niż schemat modułu).
export default defineConfig({
  schema: "./src/schema/visual-guru.ts",
  out: "./drizzle/visual-guru",
  dialect: "postgresql",
  migrations: {
    schema: "visual_guru_migrations",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
