// Odczyt tożsamości na PRAWDZIWYM Postgresie — dowód na to, czego test
// z mockiem serwisu nie pokaże: że zapytanie faktycznie trafia w wiersz po
// znormalizowanym e-mailu, że brak wiersza daje `null` (a nie wyjątek), i że
// użytkownik nieaktywny NADAL zwraca swoją nazwę (celowo — to warstwa
// wyświetlania, nie dostępu, patrz komentarz przy getUserDisplayName).
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/identity.integration.test.ts

import { closeDb, getDb, users } from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { getUserDisplayName } from "./identity"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Patrz rbac.integration.test.ts — sam zegar kolidował przy równoległym starcie
// plików integracyjnych i fixture'y kasowały się nawzajem.
const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const NAMED_EMAIL = `nazwany-${SUFFIX}@firma.pl`
const NAMELESS_EMAIL = `beznazwy-${SUFFIX}@firma.pl`
const INACTIVE_EMAIL = `nieaktywny-${SUFFIX}@firma.pl`
const ABSENT_EMAIL = `nieobecny-${SUFFIX}@firma.pl`

async function cleanup(): Promise<void> {
  const db = getDb()
  for (const email of [NAMED_EMAIL, NAMELESS_EMAIL, INACTIVE_EMAIL]) {
    await db.delete(users).where(eq(users.email, email))
  }
}

describe.skipIf(!hasDatabase)("getUserDisplayName — prawdziwy Postgres", () => {
  beforeEach(async () => {
    await cleanup()
    await getDb()
      .insert(users)
      .values([
        { email: NAMED_EMAIL, fullName: "Jan Kowalski" },
        { email: NAMELESS_EMAIL, fullName: null },
        { email: INACTIVE_EMAIL, fullName: "Nieaktywna Osoba", isActive: false },
      ])
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it("zwraca full_name użytkownika", async () => {
    expect(await getUserDisplayName(NAMED_EMAIL)).toBe("Jan Kowalski")
  })

  it("dopasowuje e-mail bez względu na wielkość liter i białe znaki", async () => {
    expect(await getUserDisplayName(`  ${NAMED_EMAIL.toUpperCase()}  `)).toBe("Jan Kowalski")
  })

  it("zwraca null, gdy użytkownika NIE MA w bazie — bez wyjątku", async () => {
    expect(await getUserDisplayName(ABSENT_EMAIL)).toBeNull()
  })

  it("zwraca null, gdy użytkownik jest, ale bez full_name", async () => {
    expect(await getUserDisplayName(NAMELESS_EMAIL)).toBeNull()
  })

  it("zwraca nazwę TAKŻE użytkownikowi nieaktywnemu — to warstwa wyświetlania, nie bramka", async () => {
    // Świadoma różnica względem rbac-store.ts, gdzie is_active odcina granty.
    // Dostęp temu użytkownikowi odbiera /api/me/access; ta funkcja karmi
    // wyłącznie menu użytkownika w powłoce i nie ma czego bramkować.
    expect(await getUserDisplayName(INACTIVE_EMAIL)).toBe("Nieaktywna Osoba")
  })
})
