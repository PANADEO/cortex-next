// Mutacje uprawnień na PRAWDZIWYM Postgresie — dowód na dwa krytyczne
// znaleziska z review:
//
//  1. Odebranie/nadanie dostępu działa NATYCHMIAST. Testy NIE wołają
//     clearTileAccessCache() ręcznie — o to właśnie chodzi: jeżeli mutacja
//     przestanie czyścić cache, te testy zaczną padać.
//  2. Aplikacji `system-config` nie da się zmienić w sposób odcinający dostęp
//     do modułu administracyjnego (blokada w SERWISIE, nie w formularzu).
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/system-config.integration.test.ts

import {
  applications,
  closeDb,
  getDb,
  permissionsMatrix,
  roles,
  userRoles,
  users,
} from "@cortex/db"
import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { clearTileAccessCache, requireTileAccess } from "./rbac"
import {
  SYSTEM_CONFIG_APP_CODE,
  SelfLockoutError,
  deleteApplication,
  setApplicationRoles,
  setRoleApplications,
  setUserRoles,
  updateApplication,
} from "./system-config"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Patrz rbac.integration.test.ts — sam Date.now() kolidował przy równoległym
// starcie obu plików i fixture'y kasowały się nawzajem.
const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const APP_CODE = `kafelek-${SUFFIX}`
const ROLE_CODE = `rola-${SUFFIX}`
const EMAIL = `tester-${SUFFIX}@firma.pl`
// Rola bez ANI JEDNEGO użytkownika i użytkownik nieaktywny — materiał na
// dowód, że niezmiennik liczy ludzi, a nie role.
const EXTERNAL_APP_CODE = `kafelek-zew-${SUFFIX}`
const EMPTY_ROLE_CODE = `pusta-rola-${SUFFIX}`
const INACTIVE_ROLE_CODE = `martwa-rola-${SUFFIX}`
const INACTIVE_EMAIL = `nieaktywny-${SUFFIX}@firma.pl`
const SECOND_EMAIL = `drugi-${SUFFIX}@firma.pl`

let userId = ""
let roleId = ""
let applicationId = ""
let emptyRoleId = ""
let inactiveRoleId = ""
let inactiveUserId = ""
let secondUserId = ""

function makeRequest(email: string): Request {
  return new Request("http://localhost/api/system-config/users", {
    headers: { "x-auth-request-email": email },
  })
}

/** UWAGA: bez clearTileAccessCache() — sprawdzamy, czy zrobiła to mutacja. */
async function canAccess(): Promise<boolean> {
  const result = await requireTileAccess(makeRequest(EMAIL), APP_CODE)
  return result.allowed
}

/** Ilu AKTYWNYCH ludzi realnie wejdzie do modułu — miara, którą niezmiennik ma
 *  utrzymać powyżej zera niezależnie od tego, ile mutacji poszło naraz. */
async function activeModuleHolders(moduleId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(permissionsMatrix, eq(permissionsMatrix.roleId, userRoles.roleId))
    .where(and(eq(users.isActive, true), eq(permissionsMatrix.applicationId, moduleId)))

  return new Set(rows.map((row) => row.id)).size
}

/** Otwiera drugie połączenie ZANIM zacznie się wyścig. postgres.js dokłada je
 *  leniwie, więc PIERWSZA para równoległych transakcji w procesie wychodzi i tak
 *  sekwencyjnie (druga czeka na nawiązanie połączenia i widzi już commit
 *  pierwszej) — bez tego test współbieżności po cichu przestaje testować
 *  współbieżność i przechodzi nawet na kodzie bez blokady. Zmierzone: bez
 *  rozgrzania 1. próba wychodzi sekwencyjnie, kolejne 4/4 ścigają się. */
async function warmPool(): Promise<void> {
  const db = getDb()
  const touch = async (tx: { select: typeof db.select }) => {
    await tx.select({ id: users.id }).from(users).limit(1)
  }

  await Promise.all([db.transaction(touch), db.transaction(touch)])
}

function rejections(results: PromiseSettledResult<unknown>[]): unknown[] {
  return results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason)
}

const NATIVE_INPUT = {
  code: APP_CODE,
  name: "Kafelek testowy",
  kind: "native" as const,
  route: `/${APP_CODE}`,
}

async function cleanup(): Promise<void> {
  const db = getDb()
  for (const email of [EMAIL, INACTIVE_EMAIL, SECOND_EMAIL]) {
    await db.delete(users).where(eq(users.email, email))
  }
  for (const code of [APP_CODE, EXTERNAL_APP_CODE]) {
    await db.delete(applications).where(eq(applications.code, code))
  }
  for (const code of [ROLE_CODE, EMPTY_ROLE_CODE, INACTIVE_ROLE_CODE]) {
    await db.delete(roles).where(eq(roles.code, code))
  }
}

describe.skipIf(!hasDatabase)("mutacje uprawnień — prawdziwy Postgres", () => {
  beforeEach(async () => {
    const db = getDb()
    await cleanup()

    const [user] = await db.insert(users).values({ email: EMAIL }).returning()
    const [role] = await db
      .insert(roles)
      .values({ code: ROLE_CODE, name: "Rola testowa" })
      .returning()
    const [application] = await db.insert(applications).values(NATIVE_INPUT).returning()

    userId = user!.id
    roleId = role!.id
    applicationId = application!.id

    await db.insert(userRoles).values({ userId, roleId })
    await db.insert(permissionsMatrix).values({ roleId, applicationId })

    const [emptyRole] = await db
      .insert(roles)
      .values({ code: EMPTY_ROLE_CODE, name: "Rola bez użytkowników" })
      .returning()
    emptyRoleId = emptyRole!.id

    const [inactiveRole] = await db
      .insert(roles)
      .values({ code: INACTIVE_ROLE_CODE, name: "Rola z samym nieaktywnym" })
      .returning()
    inactiveRoleId = inactiveRole!.id

    const [inactiveUser] = await db
      .insert(users)
      .values({ email: INACTIVE_EMAIL, isActive: false })
      .returning()
    inactiveUserId = inactiveUser!.id
    await db.insert(userRoles).values({ userId: inactiveUserId, roleId: inactiveRoleId })

    const [secondUser] = await db.insert(users).values({ email: SECOND_EMAIL }).returning()
    secondUserId = secondUser!.id

    clearTileAccessCache()
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  describe("natychmiastowa inwalidacja cache", () => {
    it("setUserRoles — odebranie roli odcina OD RAZU, nie po TTL", async () => {
      expect(await canAccess()).toBe(true)

      await setUserRoles(userId, [])

      expect(await canAccess()).toBe(false)
    })

    it("setUserRoles — nadanie roli wpuszcza OD RAZU", async () => {
      await setUserRoles(userId, [])
      expect(await canAccess()).toBe(false)

      await setUserRoles(userId, [roleId])

      expect(await canAccess()).toBe(true)
    })

    it("setApplicationRoles — odebranie grantu roli odcina OD RAZU", async () => {
      expect(await canAccess()).toBe(true)

      await setApplicationRoles(applicationId, [])

      expect(await canAccess()).toBe(false)
    })

    it("setApplicationRoles — nadanie grantu wpuszcza OD RAZU", async () => {
      await setApplicationRoles(applicationId, [])
      expect(await canAccess()).toBe(false)

      await setApplicationRoles(applicationId, [roleId])

      expect(await canAccess()).toBe(true)
    })

    it("updateApplication — dezaktywacja aplikacji odcina OD RAZU", async () => {
      expect(await canAccess()).toBe(true)

      await updateApplication(applicationId, { ...NATIVE_INPUT, isActive: false })

      expect(await canAccess()).toBe(false)
    })

    it("deleteApplication — usunięcie aplikacji odcina OD RAZU", async () => {
      expect(await canAccess()).toBe(true)

      await deleteApplication(applicationId)

      expect(await canAccess()).toBe(false)
    })
  })

  // Ten blok operuje na PRAWDZIWYM wierszu `system-config` (nie da się inaczej
  // sprawdzić blokady, która jest po nim rozpoznawana). Dlatego przed każdym
  // testem robi snapshot wiersza i jego grantów, a po teście je przywraca —
  // inaczej suita odbierałaby dostęp do modułu w bazie, na której ją puszczono.
  describe("ochrona przed samo-zablokowaniem", () => {
    let systemConfigId = ""
    let snapshotRow: typeof applications.$inferSelect | undefined
    let snapshotRoleIds: string[] = []

    beforeEach(async () => {
      const db = getDb()
      const [existing] = await db
        .select()
        .from(applications)
        .where(eq(applications.code, SYSTEM_CONFIG_APP_CODE))

      snapshotRow = existing
      systemConfigId =
        existing?.id ??
        (
          await db
            .insert(applications)
            .values({
              code: SYSTEM_CONFIG_APP_CODE,
              name: "Konfiguracja Systemu",
              kind: "native",
              route: "/system-config",
            })
            .returning()
        )[0]!.id

      snapshotRoleIds = (
        await db
          .select({ roleId: permissionsMatrix.roleId })
          .from(permissionsMatrix)
          .where(eq(permissionsMatrix.applicationId, systemConfigId))
      ).map((row) => row.roleId)

      // Stan wyjściowy każdego testu w tym bloku: moduł osiągalny DOKŁADNIE
      // przez rolę testową, którą ma aktywny użytkownik testowy. Bez tego wynik
      // zależałby od tego, kogo akurat ma baza, na której puszczono suitę —
      // a niezmiennik przepuszcza operacje na module i tak już nieosiągalnym.
      await db.delete(permissionsMatrix).where(eq(permissionsMatrix.applicationId, systemConfigId))
      await db.insert(permissionsMatrix).values({ roleId, applicationId: systemConfigId })
      clearTileAccessCache()
    })

    afterEach(async () => {
      const db = getDb()

      if (snapshotRow) {
        await db
          .update(applications)
          .set(snapshotRow)
          .where(eq(applications.id, systemConfigId))
      }

      await db.delete(permissionsMatrix).where(eq(permissionsMatrix.applicationId, systemConfigId))
      if (snapshotRoleIds.length > 0) {
        await db
          .insert(permissionsMatrix)
          .values(snapshotRoleIds.map((roleId) => ({ roleId, applicationId: systemConfigId })))
      }
    })

    const baseInput = {
      code: SYSTEM_CONFIG_APP_CODE,
      name: "Konfiguracja Systemu",
      kind: "native" as const,
      route: "/system-config",
    }

    it("odrzuca dezaktywację", async () => {
      await expect(
        updateApplication(systemConfigId, { ...baseInput, isActive: false }),
      ).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("odrzuca zmianę kodu", async () => {
      await expect(
        updateApplication(systemConfigId, { ...baseInput, code: "cos-innego" }),
      ).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("odrzuca usunięcie", async () => {
      await expect(deleteApplication(systemConfigId)).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("wiersz przeżywa odrzucone próby w nienaruszonym stanie", async () => {
      await updateApplication(systemConfigId, { ...baseInput, isActive: false }).catch(() => {})
      await deleteApplication(systemConfigId).catch(() => {})

      const [row] = await getDb()
        .select()
        .from(applications)
        .where(eq(applications.code, SYSTEM_CONFIG_APP_CODE))

      expect(row).toBeDefined()
      expect(row!.isActive).toBe(true)
      expect(row!.code).toBe(SYSTEM_CONFIG_APP_CODE)
    })

    it("przepuszcza nieszkodliwą edycję tej samej aplikacji", async () => {
      const updated = await updateApplication(systemConfigId, {
        ...baseInput,
        description: "Użytkownicy, role, uprawnienia i aplikacje instancji",
      })

      expect(updated?.isActive).toBe(true)
      expect(updated?.description).toContain("uprawnienia")
    })

    it("odrzuca odebranie dostępu OSTATNIEJ roli (nikt nie wszedłby do modułu)", async () => {
      await expect(setApplicationRoles(systemConfigId, [])).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("pozwala przepiąć dostęp na inną rolę, dopóki ktoś go zachowuje", async () => {
      await setApplicationRoles(systemConfigId, [roleId])

      const granted = await getDb()
        .select({ roleId: permissionsMatrix.roleId })
        .from(permissionsMatrix)
        .where(eq(permissionsMatrix.applicationId, systemConfigId))

      expect(granted.map((row) => row.roleId)).toEqual([roleId])
    })

    // Sedno N1: niezmiennik liczy AKTYWNYCH LUDZI, nie role. Sprawdzenie
    // "wanted.length === 0" przepuszczało oba poniższe zapisy i dawało pełny
    // lockout modułu dwoma kliknięciami w sekcji Uprawnienia.
    it("odrzuca przepięcie na rolę, której nie ma ANI JEDEN użytkownik", async () => {
      await expect(setApplicationRoles(systemConfigId, [emptyRoleId])).rejects.toBeInstanceOf(
        SelfLockoutError,
      )

      const granted = await getDb()
        .select({ roleId: permissionsMatrix.roleId })
        .from(permissionsMatrix)
        .where(eq(permissionsMatrix.applicationId, systemConfigId))
      expect(granted.map((row) => row.roleId)).toEqual([roleId])
    })

    it("odrzuca przepięcie na rolę, której jedyny użytkownik jest NIEAKTYWNY", async () => {
      await expect(setApplicationRoles(systemConfigId, [inactiveRoleId])).rejects.toBeInstanceOf(
        SelfLockoutError,
      )
    })

    it("przepuszcza przepięcie na rolę z aktywnym użytkownikiem (kontrola negatywna)", async () => {
      const db = getDb()
      await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })

      await setApplicationRoles(systemConfigId, [emptyRoleId])

      const granted = await db
        .select({ roleId: permissionsMatrix.roleId })
        .from(permissionsMatrix)
        .where(eq(permissionsMatrix.applicationId, systemConfigId))
      expect(granted.map((row) => row.roleId)).toEqual([emptyRoleId])
    })

    // Drugi kierunek TEGO SAMEGO niezmiennika (otwarte pytanie #1 z rundy 1):
    // użytkownik odbierający rolę sobie samemu.
    it("odrzuca odebranie ostatniemu aktywnemu użytkownikowi jego dostępu do modułu", async () => {
      await expect(setUserRoles(userId, [])).rejects.toBeInstanceOf(SelfLockoutError)

      const stillThere = await getDb()
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId))
      expect(stillThere.map((row) => row.roleId)).toContain(roleId)
    })

    it("odrzuca też przepięcie się na rolę bez dostępu do modułu", async () => {
      await expect(setUserRoles(userId, [emptyRoleId])).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("pozwala odebrać rolę, gdy INNY aktywny użytkownik zachowuje dostęp", async () => {
      const db = getDb()
      await db.insert(userRoles).values({ userId: secondUserId, roleId })

      await setUserRoles(userId, [])

      const left = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId))
      expect(left).toHaveLength(0)
    })

    it("nie liczy NIEAKTYWNEGO użytkownika jako zabezpieczenia", async () => {
      const db = getDb()
      await db.insert(userRoles).values({ userId: inactiveUserId, roleId })

      await expect(setUserRoles(userId, [])).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("nie przeszkadza użytkownikowi bez dostępu do modułu (kontrola negatywna)", async () => {
      const db = getDb()
      await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })

      await setUserRoles(secondUserId, [])

      const left = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, secondUserId))
      expect(left).toHaveLength(0)
    })

    // N5: `kind`/`route`/`url` wiersza system-config są tak samo niezmienne jak
    // `code` — inaczej wejście do administracji da się podmienić na obcy adres.
    it("odrzuca podmianę typu i adresu na zewnętrzny", async () => {
      await expect(
        updateApplication(systemConfigId, {
          kind: "external-link",
          url: "https://evil.example/przejete",
        }),
      ).rejects.toBeInstanceOf(SelfLockoutError)

      const [row] = await getDb()
        .select()
        .from(applications)
        .where(eq(applications.id, systemConfigId))
      expect(row!.kind).toBe("native")
      expect(row!.url).toBeNull()
    })

    it("odrzuca podmianę samej ścieżki", async () => {
      await expect(
        updateApplication(systemConfigId, { route: "/gdzie-indziej" }),
      ).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("zwykła aplikacja może zostać bez żadnej uprawnionej roli", async () => {
      await setApplicationRoles(applicationId, [])
      expect(await canAccess()).toBe(false)
    })

    it("NIE blokuje dezaktywacji ani usunięcia zwykłej aplikacji", async () => {
      const deactivated = await updateApplication(applicationId, {
        ...NATIVE_INPUT,
        isActive: false,
      })
      expect(deactivated?.isActive).toBe(false)

      expect(await deleteApplication(applicationId)).toBe(true)
    })

    // R1: niezmiennik był poprawny sekwencyjnie i nieszczelny współbieżnie.
    // KAŻDE z tych żądań Z OSOBNA jest legalne — dopiero para puszczona naraz
    // zostawiała zero ludzi z dostępem. Test SEKWENCYJNY tego nie złapie, więc
    // te trzy odpalają obie mutacje przez Promise.allSettled. Asercja jest
    // odporna na kolejność: dokładnie jedna ma przejść, druga dostać
    // SelfLockoutError, a moduł ZAWSZE zostać z co najmniej jednym człowiekiem.
    describe("wyścig dwóch równoległych mutacji (TOCTOU)", () => {
      beforeEach(warmPool)

      it("dwa równoległe odebrania ról — jedno przechodzi, moduł zostaje osiągalny", async () => {
        const db = getDb()
        await db.insert(userRoles).values({ userId: secondUserId, roleId })
        clearTileAccessCache()
        expect(await activeModuleHolders(systemConfigId)).toBe(2)

        const results = await Promise.allSettled([
          setUserRoles(userId, []),
          setUserRoles(secondUserId, []),
        ])

        const rejected = rejections(results)
        expect(rejected).toHaveLength(1)
        expect(rejected[0]).toBeInstanceOf(SelfLockoutError)
        expect(await activeModuleHolders(systemConfigId)).toBe(1)
      })

      it("ekran Aplikacje równolegle z ekranem Użytkownicy — jedno przechodzi", async () => {
        const db = getDb()
        // Bob jest jedynym aktywnym posiadaczem drugiej roli, więc przepięcie
        // grantu na nią jest samo w sobie w pełni legalne — tak samo jak
        // odebranie Bobowi tej roli, dopóki grant siedzi na roli Alice.
        await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })
        clearTileAccessCache()

        const results = await Promise.allSettled([
          setApplicationRoles(systemConfigId, [emptyRoleId]),
          setUserRoles(secondUserId, []),
        ])

        const rejected = rejections(results)
        expect(rejected).toHaveLength(1)
        expect(rejected[0]).toBeInstanceOf(SelfLockoutError)
        expect(await activeModuleHolders(systemConfigId)).toBeGreaterThanOrEqual(1)
      })

      it("kierunek rola->aplikacje bierze tę samą blokadę co pozostałe", async () => {
        const db = getDb()
        await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })
        await db
          .insert(permissionsMatrix)
          .values({ roleId: emptyRoleId, applicationId: systemConfigId })
        clearTileAccessCache()
        expect(await activeModuleHolders(systemConfigId)).toBe(2)

        const results = await Promise.allSettled([
          setRoleApplications(roleId, []),
          setUserRoles(secondUserId, []),
        ])

        const rejected = rejections(results)
        expect(rejected).toHaveLength(1)
        expect(rejected[0]).toBeInstanceOf(SelfLockoutError)
        expect(await activeModuleHolders(systemConfigId)).toBeGreaterThanOrEqual(1)
      })
    })

    // R2: setRoleApplications() nie ma dziś route'a, więc guard-coverage.test.ts
    // jej nie widzi — te testy wołają ją WPROST, żeby niezmiennik był na
    // miejscu w dniu, w którym ktoś dorobi ekran "rola -> aplikacje".
    describe("setRoleApplications — kierunek rola -> aplikacje", () => {
      it("odrzuca zdjęcie grantu ostatniej roli z aktywnym użytkownikiem", async () => {
        await expect(setRoleApplications(roleId, [])).rejects.toBeInstanceOf(SelfLockoutError)

        const granted = await getDb()
          .select({ roleId: permissionsMatrix.roleId })
          .from(permissionsMatrix)
          .where(eq(permissionsMatrix.applicationId, systemConfigId))
        expect(granted.map((row) => row.roleId)).toEqual([roleId])
      })

      it("odrzuca też zestaw, w którym modułu po prostu nie ma", async () => {
        await expect(setRoleApplications(roleId, [applicationId])).rejects.toBeInstanceOf(
          SelfLockoutError,
        )
      })

      it("przepuszcza, gdy dostęp zachowuje inna rola z aktywnym użytkownikiem", async () => {
        const db = getDb()
        await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })
        await db
          .insert(permissionsMatrix)
          .values({ roleId: emptyRoleId, applicationId: systemConfigId })

        await setRoleApplications(roleId, [])

        const granted = await db
          .select({ roleId: permissionsMatrix.roleId })
          .from(permissionsMatrix)
          .where(eq(permissionsMatrix.applicationId, systemConfigId))
        expect(granted.map((row) => row.roleId)).toEqual([emptyRoleId])
      })

      it("nie przeszkadza roli bez grantu do modułu (kontrola negatywna)", async () => {
        await setRoleApplications(emptyRoleId, [applicationId])

        const granted = await getDb()
          .select({ applicationId: permissionsMatrix.applicationId })
          .from(permissionsMatrix)
          .where(eq(permissionsMatrix.roleId, emptyRoleId))
        expect(granted.map((row) => row.applicationId)).toEqual([applicationId])
      })
    })
  })

  // N6: PATCH miał semantykę PUT — pola pominięte w body wracały do wartości
  // domyślnych, więc formularz kasował `target` przy każdym zapisie.
  describe("częściowa aktualizacja (PATCH)", () => {
    let externalId = ""

    beforeEach(async () => {
      const [created] = await getDb()
        .insert(applications)
        .values({
          code: EXTERNAL_APP_CODE,
          name: "Czat zewnętrzny",
          description: "Opis do zachowania",
          icon: "MessageSquare",
          category: "Narzędzia",
          kind: "external-link",
          url: "https://chat.example.com",
          target: "_blank",
          sortOrder: 100,
        })
        .returning()
      externalId = created!.id
    })

    it("zmiana jednego pola NIE kasuje pozostałych", async () => {
      const updated = await updateApplication(externalId, { name: "Czat zewnętrzny v2" })

      expect(updated?.name).toBe("Czat zewnętrzny v2")
      expect(updated?.target).toBe("_blank")
      expect(updated?.description).toBe("Opis do zachowania")
      expect(updated?.icon).toBe("MessageSquare")
      expect(updated?.category).toBe("Narzędzia")
      expect(updated?.sortOrder).toBe(100)
      expect(updated?.url).toBe("https://chat.example.com")
    })

    it("jawny null czyści pole (odróżnia 'nie podano' od 'wyczyść')", async () => {
      const updated = await updateApplication(externalId, { description: null })

      expect(updated?.description).toBeNull()
      expect(updated?.target).toBe("_blank")
    })

    it("zmiana typu przenosi adres i zeruje ten z poprzedniego typu", async () => {
      const updated = await updateApplication(externalId, {
        kind: "native",
        route: "/czat-wewnetrzny",
      })

      expect(updated?.kind).toBe("native")
      expect(updated?.route).toBe("/czat-wewnetrzny")
      expect(updated?.url).toBeNull()
    })

    it("odrzuca PATCH, po którym scalony wiersz łamie kształt", async () => {
      await expect(updateApplication(externalId, { kind: "native" })).rejects.toThrow()
    })
  })
})
