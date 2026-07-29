import { defineConfig } from "drizzle-kit"

// Config JEDNEGO modułu. Każdy kolejny moduł dostaje własny plik, własny `out`
// i własny `migrationsSchema` — patrz code-db/REFERENCE.md.
//
// `migrationsSchema` jest tu kluczowe: domyślnie Drizzle trzyma stan migracji
// w `drizzle.__drizzle_migrations`, wspólnym dla całej bazy. Przy wielu
// modułach w jednym Postgresie drugi moduł potrafi po cichu POMINĄĆ swoje
// migracje, bo tabela "już istnieje". Stąd tabela stanu per schemat.
// UWAGA na kształt opcji: w drizzle-kit 0.28.x działa zagnieżdżone
// `migrations: { schema }`. Płaskie `migrationsSchema` na najwyższym poziomie
// (tak jak było w code-db/REFERENCE.md) jest po cichu IGNOROWANE — defineConfig
// nie odrzuca nieznanego klucza, a tabela stanu ląduje w domyślnym schemacie
// `drizzle`. Zweryfikowane na żywo, patrz notatka Obsidian.
export default defineConfig({
  schema: "./src/schema/konfiguracja-systemu.ts",
  out: "./drizzle/konfiguracja-systemu",
  dialect: "postgresql",
  // Schemat tabeli stanu migracji MUSI być inny niż schemat modułu:
  // drizzle-kit zakłada go sam przed uruchomieniem migracji, więc wskazanie
  // "konfiguracja_systemu" wywraca własne `CREATE SCHEMA` migracji 0000
  // ("schema already exists"). Stąd dedykowany schemat *_migrations.
  migrations: {
    schema: "konfiguracja_systemu_migrations",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
