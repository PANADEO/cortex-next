# code-db — REFERENCE

## Wzorzec schema-per-moduł w Drizzle

```ts
// packages/@cortex/db/src/schema/konfiguracja-systemu.ts
import { pgSchema, uuid, text, timestamp } from "drizzle-orm/pg-core"

export const konfiguracjaSystemu = pgSchema("konfiguracja_systemu")

export const users = konfiguracjaSystemu.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

## Pułapka: kolizja tabeli migracji Drizzle między modułami

Domyślnie Drizzle śledzi zastosowane migracje w tabeli `drizzle.__drizzle_migrations` — jedna nazwa, wspólna dla całej bazy. Przy WIELU niezależnych configach Drizzle (jeden per moduł/schemat) w tym samym Postgresie, druga i kolejne instancje mogą po cichu pominąć swoje migracje, bo tabela "już istnieje" (założona przez pierwszy moduł).

**Rozwiązanie**: jawnie ustaw `migrationsSchema` per moduł w `drizzle.config.ts`:

```ts
export default defineConfig({
  schema: "./src/schema/konfiguracja-systemu.ts",
  out: "./drizzle/konfiguracja-systemu",
  dialect: "postgresql",
  migrationsSchema: "konfiguracja_systemu", // NIE domyślne "drizzle"
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
```

Każdy moduł = osobny plik configu + osobny `out` + osobny `migrationsSchema`. Nie dzielić jednego `drizzle.config.ts` między moduły.

## Kształt pierwszego schematu (`konfiguracja_systemu`, Ścieżka E)

Wzorem audytu cortex-admin (`PROJECT/cortex-frontend-cortex-admin-audyt-funkcji.md`, sekcja "Rdzeń — PORTOWAĆ") — **siedem tabel, obie warstwy uprawnień naraz, nie tylko jedna**:
- `users`, `roles`, `user_roles` — tożsamość i role.
- `applications` — rejestr kafelków, rozszerzony o `route`/`kind`/`url` dla wymogu "kafelki przez UX" (nowość względem cortex-admin).
- `permissions_matrix` — GRUBOZIARNISTY dostęp rola↔aplikacja ("czy rola ma w ogóle dostęp do tego kafelka"). To osobna tabela od poniższej, nie duplikat — cortex-admin ma obie warstwy naraz i obie są używane.
- `application_scopes`, `role_application_scopes` — GRANULARNE uprawnienia rola↔aplikacja↔scope (np. `view`/`edit`/`generate` w ramach jednego kafelka).

Świadomie NIE portować 1:1: `api_keys` (dziś częściowo martwe w cortex-admin), `prompts` (dziś atrapa) — projektować od nowa jeśli w ogóle wchodzą w zakres.
