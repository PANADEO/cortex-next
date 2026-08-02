// listHubApplications() na PRAWDZIWYM Postgresie — Krok 2 (D7,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md). Review Kroku 2 wymaga
// wprost: "potwierdzić brak jakiegokolwiek JOIN-a z
// permissions_matrix/user_roles w tej ścieżce" — NIE eyeballing kodu. Blok
// "brak JOIN-a" niżej dowodzi tego BEHAWIORALNIE: wiersz bez ani jednego
// grantu w permissions_matrix i tak wraca (obala INNER JOIN), a wiersz z
// dwoma grantami wraca DOKŁADNIE RAZ (obala LEFT JOIN bez DISTINCT/fan-out).
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/hub-tiles.integration.test.ts

import { applications, closeDb, getDb, permissionsMatrix, roles } from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { listHubApplications } from "./system-config"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Patrz system-config.integration.test.ts — sam Date.now() kolidował przy
// równoległym starcie kilku plików testowych.
const SUFFIX = `hub-itest-${process.pid}-${randomUUID().slice(0, 8)}`
const CODE_PREFIX = `hub-${SUFFIX}-`

const ACTIVE_SHOWN_A = `${CODE_PREFIX}active-shown-a` // sort_order 20
const ACTIVE_SHOWN_B = `${CODE_PREFIX}active-shown-b` // sort_order 5
const ACTIVE_SHOWN_C = `${CODE_PREFIX}active-shown-c` // sort_order 10
const ACTIVE_HIDDEN = `${CODE_PREFIX}active-hidden` // is_active=true,  show_on_hub=false
const INACTIVE_SHOWN = `${CODE_PREFIX}inactive-shown` // is_active=false, show_on_hub=true
const INACTIVE_HIDDEN = `${CODE_PREFIX}inactive-hidden` // is_active=false, show_on_hub=false — obie flagi na false
const MULTI_GRANT = `${CODE_PREFIX}multi-grant` // active+shown, DWA granty w permissions_matrix
const ZERO_GRANT = `${CODE_PREFIX}zero-grant` // active+shown, ZERO grantów w permissions_matrix

const ALL_CODES = [
  ACTIVE_SHOWN_A,
  ACTIVE_SHOWN_B,
  ACTIVE_SHOWN_C,
  ACTIVE_HIDDEN,
  INACTIVE_SHOWN,
  INACTIVE_HIDDEN,
  MULTI_GRANT,
  ZERO_GRANT,
]

const ROLE_A = `hub-rola-a-${SUFFIX}`
const ROLE_B = `hub-rola-b-${SUFFIX}`

async function cleanup(): Promise<void> {
  const db = getDb()
  await db.delete(applications).where(inArray(applications.code, ALL_CODES))
  await db.delete(roles).where(inArray(roles.code, [ROLE_A, ROLE_B]))
}

/**
 * listHubApplications() czyta CAŁĄ tabelę applications (realny seed + inne
 * suity równoległe), więc bez tego filtra asercje o dokładnym zestawie/
 * kolejności zależałyby od tego, co akurat jest w bazie.
 */
function onlyThisSuite<T extends { code: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.code.startsWith(CODE_PREFIX))
}

describe.skipIf(!hasDatabase)("listHubApplications — prawdziwy Postgres", () => {
  beforeAll(async () => {
    const db = getDb()
    await cleanup()

    const [roleA] = await db.insert(roles).values({ code: ROLE_A, name: "Rola A (hub itest)" }).returning()
    const [roleB] = await db.insert(roles).values({ code: ROLE_B, name: "Rola B (hub itest)" }).returning()

    await db.insert(applications).values([
      {
        code: ACTIVE_SHOWN_A,
        name: "Aktywny widoczny A",
        kind: "native",
        route: `/${ACTIVE_SHOWN_A}`,
        isActive: true,
        showOnHub: true,
        sortOrder: 20,
      },
      {
        code: ACTIVE_SHOWN_B,
        name: "Aktywny widoczny B",
        kind: "native",
        route: `/${ACTIVE_SHOWN_B}`,
        isActive: true,
        showOnHub: true,
        sortOrder: 5,
      },
      {
        code: ACTIVE_SHOWN_C,
        name: "Aktywny widoczny C",
        kind: "native",
        route: `/${ACTIVE_SHOWN_C}`,
        isActive: true,
        showOnHub: true,
        sortOrder: 10,
      },
      {
        code: ACTIVE_HIDDEN,
        name: "Aktywny, nie kafelek (np. grant zbiorczy)",
        kind: "native",
        route: `/${ACTIVE_HIDDEN}`,
        isActive: true,
        showOnHub: false,
        sortOrder: 1,
      },
      {
        code: INACTIVE_SHOWN,
        name: "Wyłączony, ale oznaczony jako kafelek",
        kind: "native",
        route: `/${INACTIVE_SHOWN}`,
        isActive: false,
        showOnHub: true,
        sortOrder: 1,
      },
      {
        code: INACTIVE_HIDDEN,
        name: "Wyłączony i nie kafelek",
        kind: "native",
        route: `/${INACTIVE_HIDDEN}`,
        isActive: false,
        showOnHub: false,
        sortOrder: 1,
      },
      {
        code: MULTI_GRANT,
        name: "Kafelek z dwoma grantami ról",
        kind: "native",
        route: `/${MULTI_GRANT}`,
        isActive: true,
        showOnHub: true,
        sortOrder: 1,
      },
      {
        code: ZERO_GRANT,
        name: "Kafelek bez ani jednego grantu roli",
        kind: "native",
        route: `/${ZERO_GRANT}`,
        isActive: true,
        showOnHub: true,
        sortOrder: 1,
      },
    ])

    const [multiGrantApp] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.code, MULTI_GRANT))
    await db.insert(permissionsMatrix).values([
      { roleId: roleA!.id, applicationId: multiGrantApp!.id },
      { roleId: roleB!.id, applicationId: multiGrantApp!.id },
    ])
    // ZERO_GRANT celowo NIE dostaje ani jednego wiersza w permissions_matrix.
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it("zwraca WYŁĄCZNIE wiersze is_active=true AND show_on_hub=true (AND, nie OR)", async () => {
    const codes = onlyThisSuite(await listHubApplications()).map((row) => row.code)

    expect(codes).toContain(ACTIVE_SHOWN_A)
    expect(codes).toContain(ACTIVE_SHOWN_B)
    expect(codes).toContain(ACTIVE_SHOWN_C)
    // Trzy kombinacje, w których PRZYNAJMNIEJ jedna flaga jest false — żadna
    // nie może przejść. Gdyby filtr był OR zamiast AND, ACTIVE_HIDDEN i
    // INACTIVE_SHOWN przeszłyby błędnie (mają po jednej fladze true).
    expect(codes).not.toContain(ACTIVE_HIDDEN)
    expect(codes).not.toContain(INACTIVE_SHOWN)
    expect(codes).not.toContain(INACTIVE_HIDDEN)
  })

  it("sortuje po sort_order rosnąco", async () => {
    const codes = onlyThisSuite(await listHubApplications())
      .filter((row) => [ACTIVE_SHOWN_A, ACTIVE_SHOWN_B, ACTIVE_SHOWN_C].includes(row.code))
      .map((row) => row.code)

    expect(codes).toEqual([ACTIVE_SHOWN_B, ACTIVE_SHOWN_C, ACTIVE_SHOWN_A]) // sort_order 5, 10, 20
  })

  describe("brak JOIN-a z permissions_matrix/user_roles — dowód behawioralny, nie eyeballing", () => {
    it("wiersz BEZ ani jednego grantu w permissions_matrix i tak się pojawia (obala INNER JOIN)", async () => {
      const codes = onlyThisSuite(await listHubApplications()).map((row) => row.code)

      expect(codes).toContain(ZERO_GRANT)
    })

    it("wiersz z DWOMA grantami w permissions_matrix pojawia się DOKŁADNIE RAZ (obala fan-out z JOIN-a bez DISTINCT)", async () => {
      const rows = onlyThisSuite(await listHubApplications()).filter((row) => row.code === MULTI_GRANT)

      expect(rows).toHaveLength(1)
    })
  })
})
