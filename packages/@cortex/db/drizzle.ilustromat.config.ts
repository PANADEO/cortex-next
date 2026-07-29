import { defineConfig } from "drizzle-kit"

// Config modułu Ilustromat. Osobny plik, osobny `out`, osobny schemat tabeli
// migracji — patrz code-db/REFERENCE.md i drizzle.system-config.config.ts.
//
// Dwie pułapki, obie potwierdzone eksperymentalnie na tym repo:
//  1. Płaskie `migrationsSchema` na najwyższym poziomie jest w drizzle-kit
//     0.28.x po cichu IGNOROWANE — defineConfig nie odrzuca nieznanego klucza,
//     a tabela stanu ląduje we wspólnym schemacie `drizzle`. Wtedy DRUGI moduł
//     potrafi pominąć swoje migracje, bo tabela "już istnieje". Poprawna jest
//     forma zagnieżdżona `migrations: { schema, table }`.
//  2. Schemat tabeli migracji MUSI być inny niż schemat modułu: drizzle-kit
//     zakłada go sam przed uruchomieniem migracji, więc wskazanie "ilustromat"
//     wywróciłoby własne `CREATE SCHEMA` migracji 0000 błędem "already exists".
export default defineConfig({
  schema: "./src/schema/ilustromat.ts",
  out: "./drizzle/ilustromat",
  dialect: "postgresql",
  migrations: {
    schema: "ilustromat_migrations",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
