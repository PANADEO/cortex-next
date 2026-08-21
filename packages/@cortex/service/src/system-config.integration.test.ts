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
  applicationScopes,
  applications,
  closeDb,
  getDb,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  userRoles,
  users,
} from "@cortex/db"
import { and, eq, inArray, max } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearTileAccessCache, requireTileAccess, requireTileScope } from "./rbac"
import {
  ModuleNotLicensedError,
  NativeApplicationImmutableError,
  NativeCreationNotAllowedError,
  SYSTEM_CONFIG_APP_CODE,
  SelfLockoutError,
  SystemRoleProtectedError,
  UnknownApplicationScopeError,
  UnknownRoleError,
  activateApplication,
  createApplication,
  createUser,
  deleteApplication,
  deleteRole,
  listApplicationScopeGrants,
  listApplicationScopes,
  listApplications,
  listHubApplications,
  listUnactivatedNativeApplications,
  renameApplicationScope,
  setApplicationRoles,
  setApplicationScopeRoles,
  setRoleApplications,
  setUserRoles,
  updateApplication,
  updateUser,
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
// D10: druga aplikacja, wyłącznie do testów "pomylonej pary" (applicationId,
// scopeId) — renameApplicationScope/setApplicationScopeRoles muszą odrzucić
// scopeId realny, ale należący do INNEJ aplikacji niż ta ze ścieżki.
const OTHER_APP_CODE = `kafelek-inny-${SUFFIX}`
const SCOPE_CODE = `zakres-${SUFFIX}`

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
  for (const code of [APP_CODE, EXTERNAL_APP_CODE, OTHER_APP_CODE]) {
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

  // D1: createUser MUSI znormalizować e-mail dokładnie tak samo jak odczyt
  // (getRequestEmail w rbac.ts), inaczej "Jan@Firma.pl" utworzony przez UI
  // nigdy nie dopasuje się do znormalizowanego adresu z nagłówka auth i
  // "istnieje" w UI, a nigdy nie zadziała.
  describe("createUser — normalizacja e-maila", () => {
    it("e-mail z wielkimi literami trafia w swój wiersz przy odczycie przez nagłówek auth", async () => {
      const db = getDb()
      const mixedCaseEmail = `Mieszany-${SUFFIX}@Firma.PL`

      const created = await createUser({ email: mixedCaseEmail })
      try {
        expect(created.email).toBe(mixedCaseEmail.toLowerCase())

        await db.insert(userRoles).values({ userId: created.id, roleId })
        clearTileAccessCache()

        // getRequestEmail (rbac.ts) normalizuje nagłówek do lowercase — to
        // dokładnie to, co createUser musiał zrobić przy zapisie.
        const result = await requireTileAccess(makeRequest(mixedCaseEmail.toLowerCase()), APP_CODE)
        expect(result.allowed).toBe(true)
      } finally {
        await db.delete(users).where(eq(users.id, created.id))
      }
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
              // Krok 5: listApplications() filtruje po activated_at (patrz opis
              // funkcji) — bez tego pola ten fallback (wiersz zniknął, np. przez
              // wyścig z inną suitą integracyjną na tej samej bazie) tworzyłby
              // wiersz nieodróżnialny od "nigdy nieaktywowanego", niespójny z
              // tym, co realny seed zawsze ustawia dla system-config.
              activatedAt: new Date(),
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
        await db.update(applications).set(snapshotRow).where(eq(applications.id, systemConfigId))
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

    // Czwarty kierunek assertModuleStaysReachable (D1): PATCH { isActive: false }
    // na użytkowniku. `userId` w tym bloku jest, przez konstrukcję beforeEach
    // powyżej, JEDYNYM aktywnym posiadaczem dostępu do systemConfigId.
    describe("updateUser — dezaktywacja użytkownika", () => {
      it("SEDNO: odrzuca dezaktywację ostatniego aktywnego użytkownika z dostępem do modułu", async () => {
        await expect(updateUser(userId, { isActive: false })).rejects.toBeInstanceOf(
          SelfLockoutError,
        )

        const [row] = await getDb().select().from(users).where(eq(users.id, userId))
        expect(row!.isActive).toBe(true)
      })

      it("pozwala dezaktywować, gdy INNY aktywny użytkownik zachowuje dostęp", async () => {
        const db = getDb()
        await db.insert(userRoles).values({ userId: secondUserId, roleId })

        const updated = await updateUser(userId, { isActive: false })

        expect(updated?.user.isActive).toBe(false)
      })

      it("reaktywacja przechodzi ZAWSZE, nawet z modułu już nieosiągalnego", async () => {
        // Odcinamy dostęp z pominięciem niezmiennika (bezpośredni UPDATE) —
        // symulacja stanu, z którego normalnie dałoby się wyjść tylko ręcznym
        // SQL-em. Operacja, która niczego nie pogarsza, ma prawo przejść.
        await getDb().update(users).set({ isActive: false }).where(eq(users.id, userId))

        const reactivated = await updateUser(userId, { isActive: true })

        expect(reactivated?.user.isActive).toBe(true)
      })

      it("edycja samego fullName nie dotyka niezmiennika", async () => {
        const updated = await updateUser(userId, { fullName: "Jan Kowalski" })

        expect(updated?.user.fullName).toBe("Jan Kowalski")
        expect(updated?.user.isActive).toBe(true)
      })
    })

    // Piąty kierunek (D2): deleteRole(). ON DELETE CASCADE na role_id kasuje
    // WSZYSTKIE granty/przypisania tej roli bez pytania — stąd jawne
    // wywołanie assertModuleStaysReachable PRZED DELETE FROM roles.
    describe("deleteRole — usunięcie roli", () => {
      it("SEDNO: odrzuca usunięcie OSTATNIEJ roli dającej dostęp do modułu (self-lockout)", async () => {
        await expect(deleteRole(roleId)).rejects.toBeInstanceOf(SelfLockoutError)

        const [row] = await getDb().select().from(roles).where(eq(roles.id, roleId))
        expect(row).toBeDefined()
      })

      it("pozwala usunąć rolę, gdy INNA rola z aktywnym użytkownikiem zachowuje dostęp", async () => {
        const db = getDb()
        await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })
        await db
          .insert(permissionsMatrix)
          .values({ roleId: emptyRoleId, applicationId: systemConfigId })

        const { removed } = await deleteRole(roleId)
        expect(removed).toBe(true)

        const [row] = await db.select().from(roles).where(eq(roles.id, roleId))
        expect(row).toBeUndefined()
      })

      it("usunięcie roli kasuje kaskadowo jej granty i przypisania użytkowników", async () => {
        const db = getDb()
        await db.insert(userRoles).values({ userId: secondUserId, roleId: emptyRoleId })
        await db
          .insert(permissionsMatrix)
          .values({ roleId: emptyRoleId, applicationId: systemConfigId })

        await deleteRole(roleId)

        const leftoverUserRoles = await db
          .select()
          .from(userRoles)
          .where(eq(userRoles.roleId, roleId))
        const leftoverGrants = await db
          .select()
          .from(permissionsMatrix)
          .where(eq(permissionsMatrix.roleId, roleId))
        expect(leftoverUserRoles).toHaveLength(0)
        expect(leftoverGrants).toHaveLength(0)
      })

      // Kolejność dwóch checków w deleteRole(): isSystem sprawdzany PIERWSZY.
      // Ta rola spełnia OBA warunki naraz (systemowa + jedyny posiadacz
      // dostępu) — musi wygrać system-role-protected, nie self-lockout.
      // Gdyby kolejność była odwrócona, ten test spadłby na złym typie błędu.
      it("SEDNO: rola isSystem jest chroniona NIEZALEŻNIE od bycia ostatnim posiadaczem dostępu", async () => {
        const db = getDb()
        const systemRoleCode = `system-rola-${SUFFIX}`

        const [systemRole] = await db
          .insert(roles)
          .values({ code: systemRoleCode, name: "Rola systemowa testowa", isSystem: true })
          .returning()

        try {
          // Jedynym posiadaczem dostępu do modułu jest TERAZ ta rola systemowa.
          await db
            .delete(permissionsMatrix)
            .where(eq(permissionsMatrix.applicationId, systemConfigId))
          await db
            .insert(permissionsMatrix)
            .values({ roleId: systemRole!.id, applicationId: systemConfigId })
          await db.insert(userRoles).values({ userId, roleId: systemRole!.id })
          clearTileAccessCache()

          await expect(deleteRole(systemRole!.id)).rejects.toBeInstanceOf(SystemRoleProtectedError)

          const [row] = await db.select().from(roles).where(eq(roles.id, systemRole!.id))
          expect(row).toBeDefined()
        } finally {
          await db.delete(roles).where(eq(roles.id, systemRole!.id))
        }
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
          // Wycofana kolumna (05.08.2026) — wstawiana tu wprost przez drizzle,
          // żeby test niżej pilnował, że PATCH jej NIE kasuje. Żadna ścieżka
          // zapisu aplikacji już jej nie ustawia; legacy wartości mają przeżyć.
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
      // Wycofana, ale wciąż w bazie — PATCH nie ma prawa jej wyzerować.
      expect(updated?.category).toBe("Narzędzia")
      expect(updated?.sortOrder).toBe(100)
      expect(updated?.url).toBe("https://chat.example.com")
    })

    it("jawny null czyści pole (odróżnia 'nie podano' od 'wyczyść')", async () => {
      const updated = await updateApplication(externalId, { description: null })

      expect(updated?.description).toBeNull()
      expect(updated?.target).toBe("_blank")
    })

    // Zmiana typu MIĘDZY external-link a iframe (obie strony wymagają `url`,
    // żadna `route`) zostaje dozwolona — niezmiennik z D6-rewizja/D10-rewizja d
    // (patrz opis niżej) blokuje WYŁĄCZNIE promocję do kind="native", nie
    // zmiany typu w obrębie kind-ów nie-natywnych.
    it("zmiana typu (external-link -> iframe) przenosi adres, gdy podany w tym samym PATCH-u", async () => {
      const updated = await updateApplication(externalId, {
        kind: "iframe",
        url: "https://chat.example.com/iframe",
      })

      expect(updated?.kind).toBe("iframe")
      expect(updated?.url).toBe("https://chat.example.com/iframe")
      expect(updated?.route).toBeNull()
    })

    it("odrzuca PATCH, po którym scalony wiersz łamie kształt", async () => {
      await expect(updateApplication(externalId, { kind: "iframe" })).rejects.toThrow()
    })
  })

  // D8-D10: warstwa granularna. `applicationId`/`roleId` to fixture'y z
  // beforeEach nadrzędnego describe'a (kafelek/rola testowa z aktywnym
  // użytkownikiem EMAIL) — reużywane tu zamiast tworzenia trzeciego kompletu.
  describe("zakresy granularne (application_scopes)", () => {
    let scopeId = ""
    let otherApplicationId = ""

    beforeEach(async () => {
      const db = getDb()

      const [scope] = await db
        .insert(applicationScopes)
        .values({ applicationId, code: SCOPE_CODE, name: "Zakres testowy" })
        .returning()
      scopeId = scope!.id

      const [otherApplication] = await db
        .insert(applications)
        .values({
          code: OTHER_APP_CODE,
          name: "Inny kafelek",
          kind: "native",
          route: `/${OTHER_APP_CODE}`,
        })
        .returning()
      otherApplicationId = otherApplication!.id
    })

    describe("listApplicationScopes", () => {
      it("zwraca katalog zakresów TEJ aplikacji", async () => {
        expect(await listApplicationScopes(applicationId)).toEqual([
          { id: scopeId, code: SCOPE_CODE, name: "Zakres testowy" },
        ])
      })

      it("nie widzi zakresów innej aplikacji", async () => {
        expect(await listApplicationScopes(otherApplicationId)).toEqual([])
      })
    })

    describe("renameApplicationScope", () => {
      it("zmienia etykietę, gdy scopeId należy do applicationId ze ścieżki", async () => {
        const updated = await renameApplicationScope(applicationId, scopeId, "Nowa etykieta")

        expect(updated?.name).toBe("Nowa etykieta")
        expect(updated?.code).toBe(SCOPE_CODE) // code niezmienny — nie ma go w applicationScopePatchSchema
      })

      // SEDNO (D10): obrona przed pomyloną parą id — scopeId jest REALNY, ale
      // należy do innej aplikacji niż ta w applicationId. Musi się zachować
      // jak "nie znaleziono", nie ciche zaakceptowanie zapisu cudzego zakresu.
      it("SEDNO: pomylona para (applicationId, scopeId) zwraca null, nie zapisuje", async () => {
        const updated = await renameApplicationScope(
          otherApplicationId,
          scopeId,
          "Nie powinno się zapisać",
        )

        expect(updated).toBeNull()

        const [row] = await getDb()
          .select()
          .from(applicationScopes)
          .where(eq(applicationScopes.id, scopeId))
        expect(row!.name).toBe("Zakres testowy")
      })

      it("nieistniejący scopeId zwraca null", async () => {
        expect(await renameApplicationScope(applicationId, randomUUID(), "X")).toBeNull()
      })
    })

    describe("listApplicationScopeGrants", () => {
      it("zwraca zakres z PUSTĄ listą ról, gdy nie ma jeszcze grantów (nie brak wpisu)", async () => {
        expect(await listApplicationScopeGrants(applicationId)).toEqual([{ scopeId, roleIds: [] }])
      })

      it("odzwierciedla granty zapisane przez setApplicationScopeRoles", async () => {
        await setApplicationScopeRoles(applicationId, scopeId, [roleId])

        expect(await listApplicationScopeGrants(applicationId)).toEqual([
          { scopeId, roleIds: [roleId] },
        ])
      })
    })

    describe("setApplicationScopeRoles", () => {
      it("SEDNO: faktycznie zapisuje granty", async () => {
        await setApplicationScopeRoles(applicationId, scopeId, [roleId])

        const granted = await getDb()
          .select({ roleId: roleApplicationScopes.roleId })
          .from(roleApplicationScopes)
          .where(eq(roleApplicationScopes.applicationScopeId, scopeId))
        expect(granted.map((row) => row.roleId)).toEqual([roleId])
      })

      it("SEDNO: NADPISUJE, nie dokłada — drugi zapis zastępuje pierwszy", async () => {
        await setApplicationScopeRoles(applicationId, scopeId, [roleId])
        await setApplicationScopeRoles(applicationId, scopeId, [emptyRoleId])

        const granted = await getDb()
          .select({ roleId: roleApplicationScopes.roleId })
          .from(roleApplicationScopes)
          .where(eq(roleApplicationScopes.applicationScopeId, scopeId))
        expect(granted.map((row) => row.roleId)).toEqual([emptyRoleId])
      })

      it("pusta lista czyści wszystkie granty tego zakresu", async () => {
        await setApplicationScopeRoles(applicationId, scopeId, [roleId])
        await setApplicationScopeRoles(applicationId, scopeId, [])

        const granted = await getDb()
          .select()
          .from(roleApplicationScopes)
          .where(eq(roleApplicationScopes.applicationScopeId, scopeId))
        expect(granted).toHaveLength(0)
      })

      it("odrzuca nieznaną rolę (UnknownRoleError, nie zapisuje nic)", async () => {
        await expect(
          setApplicationScopeRoles(applicationId, scopeId, [randomUUID()]),
        ).rejects.toBeInstanceOf(UnknownRoleError)

        const granted = await getDb()
          .select()
          .from(roleApplicationScopes)
          .where(eq(roleApplicationScopes.applicationScopeId, scopeId))
        expect(granted).toHaveLength(0)
      })

      it("SEDNO: odrzuca pomyloną parę (applicationId spoza tej aplikacji)", async () => {
        await expect(
          setApplicationScopeRoles(otherApplicationId, scopeId, [roleId]),
        ).rejects.toBeInstanceOf(UnknownApplicationScopeError)
      })

      // D9/D10 end-to-end: dowód, że ta funkcja realnie zasila DOKŁADNIE ten
      // sam mechanizm co Ilustromat (requireTileScope), nie tylko wygląda
      // podobnie w kodzie. Bez ręcznego clearTileAccessCache() — jeśli
      // setApplicationScopeRoles przestanie czyścić cache, ten test spadnie.
      it("czyści cache OD RAZU — requireTileScope widzi zmianę bez czekania na TTL", async () => {
        await setApplicationScopeRoles(applicationId, scopeId, [roleId])
        const granted = await requireTileScope(makeRequest(EMAIL), APP_CODE, SCOPE_CODE)
        expect(granted.allowed).toBe(true)

        await setApplicationScopeRoles(applicationId, scopeId, [])
        const revoked = await requireTileScope(makeRequest(EMAIL), APP_CODE, SCOPE_CODE)
        expect(revoked.allowed).toBe(false)
      })

      // D10, najważniejsze ryzyko tej sekcji: warstwa granularna NIE gatuje
      // samego system-config (guard.ts tego modułu woła WYŁĄCZNIE
      // requireTileAccess, nigdy requireTileScope — zweryfikowane osobno
      // grepem). Odebranie JEDYNEGO grantu zakresu na wierszu system-config
      // ma więc przejść bez błędu, w przeciwieństwie do analogicznej operacji
      // na warstwie gruboziarnistej (setApplicationRoles), która w tym samym
      // scenariuszu rzuciłaby SelfLockoutError.
      it("NIE gatuje system-config — odebranie ostatniego grantu zakresu na module administracyjnym przechodzi", async () => {
        const db = getDb()
        const [systemConfigApp] = await db
          .select({ id: applications.id })
          .from(applications)
          .where(eq(applications.code, SYSTEM_CONFIG_APP_CODE))
        if (!systemConfigApp) return // brak wiersza w tej bazie — nic do sprawdzenia

        const [systemScope] = await db
          .insert(applicationScopes)
          .values({
            applicationId: systemConfigApp.id,
            code: `sc-zakres-${SUFFIX}`,
            name: "Testowy scope SC",
          })
          .returning()

        try {
          await setApplicationScopeRoles(systemConfigApp.id, systemScope!.id, [roleId])

          await expect(
            setApplicationScopeRoles(systemConfigApp.id, systemScope!.id, []),
          ).resolves.toBeUndefined()
        } finally {
          await db.delete(applicationScopes).where(eq(applicationScopes.id, systemScope!.id))
        }
      })
    })
  })

  // D6-rewizja/D10-rewizja d (PROJECT/cortex-frontend-hub-db-driven-projekt.md):
  // kind=native może powstać WYŁĄCZNIE przez aktywację manifestu, nigdy przez
  // POST/createApplication — i route/code/kind stają się niezmienne po
  // utworzeniu. Egzekwowane w SERWISIE (nie tylko w formularzu/routingu), więc
  // testowane tutaj wprost na funkcjach serwisowych, na prawdziwym Postgresie.
  describe("D6-rewizja/D10-rewizja d — kind=native wyłącznie przez aktywację manifestu", () => {
    const MANIFEST_CODE = `manifest-${SUFFIX}`
    const MANIFEST_ROUTE = `/${MANIFEST_CODE}`
    // Krok 5: kontrola negatywna dla listApplications() poniżej — CELOWO
    // własny, jednorazowy wiersz zamiast dzielonego singleton-a (np.
    // system-config), za który odpowiada RÓWNOLEGLE inna suita integracyjna
    // na tej samej, prawdziwej bazie (np. rbac.integration.test.ts). Dzielony
    // wiersz okazał się realnie niedeterministyczny pod pełnym `pnpm test`
    // (vitest uruchamia pliki integracyjne równolegle) — ten wiersz istnieje
    // wyłącznie w obrębie tego testu, więc żaden wyścig go nie dotyczy.
    const CONTROL_CODE = `manifest-control-${SUFFIX}`
    // K1b: wiersz-uprawnienie, czyli odpowiednik ai-tools/cortex-cowork/obu
    // edytorów Intrastatu. Różni się od kafelka WYŁĄCZNIE tym, co
    // seed-tile-manifests.mjs wstawił mu w `show_on_hub` na podstawie
    // manifestowego `entitlementOnly` — dla aktywacji jest nieodróżnialny.
    const ENTITLEMENT_CODE = `manifest-uprawnienie-${SUFFIX}`

    afterEach(async () => {
      await getDb().delete(applications).where(eq(applications.code, MANIFEST_CODE))
      await getDb().delete(applications).where(eq(applications.code, CONTROL_CODE))
      await getDb().delete(applications).where(eq(applications.code, ENTITLEMENT_CODE))
    })

    it("createApplication odrzuca kind=native (POST zostaje wyłącznie dla external-link/iframe)", async () => {
      await expect(
        createApplication({
          code: MANIFEST_CODE,
          name: "Kandydat natywny przez formularz",
          kind: "native",
          route: MANIFEST_ROUTE,
        }),
      ).rejects.toBeInstanceOf(NativeCreationNotAllowedError)
    })

    it("createApplication nadal akceptuje kind=external-link — ścieżka formularza bez zmian", async () => {
      const created = await createApplication({
        code: MANIFEST_CODE,
        name: "Link zewnętrzny",
        kind: "external-link",
        url: "https://example.com",
      })
      expect(created.kind).toBe("external-link")
      expect(created.activatedAt).toBeNull()
    })

    it("listUnactivatedNativeApplications widzi wiersz native z activated_at=null, pomija aktywowane i external-link", async () => {
      await getDb().insert(applications).values({
        code: MANIFEST_CODE,
        name: "Nieaktywowany moduł",
        kind: "native",
        route: MANIFEST_ROUTE,
        isActive: false,
        showOnHub: false,
        activatedAt: null,
      })

      const candidates = await listUnactivatedNativeApplications()
      const codes = candidates.map((row) => row.code)

      expect(codes).toContain(MANIFEST_CODE)
      // APP_CODE (fixture beforeEach) jest native, ale aktywny/nie ma activated_at
      // ustawionego celowo na null w tym teście — sprawdzone osobno niżej z
      // jawnym activatedAt, żeby nie polegać na domyślnym stanie fixture'a.
      expect(codes).not.toContain(EXTERNAL_APP_CODE)
    })

    // `showOnHub: true` w fixturze to NIE kosmetyka — tak od K1b wygląda
    // wiersz prawdziwego kafelka zaraz po rejestracji (seed-tile-manifests.mjs
    // wstawia `show_on_hub` z manifestowego `entitlementOnly`, a `is_active`
    // zostawia na `false`). Przed K1b fixture stawiał `false`, bo seed też
    // stawiał `false` dla każdego, a aktywacja podnosiła kolumnę bezwarunkowo.
    it("activateApplication aktywuje wiersz i jest bezpieczna na wyścig — drugie wywołanie to no-op, nie błąd", async () => {
      await getDb().insert(applications).values({
        code: MANIFEST_CODE,
        name: "Nieaktywowany moduł",
        kind: "native",
        route: MANIFEST_ROUTE,
        isActive: false,
        showOnHub: true,
        activatedAt: null,
      })

      // Bez asercji na showOnHub — od K1b aktywacja do tej kolumny NIE PISZE,
      // więc sprawdzanie jej tutaj mierzyłoby wyłącznie fixture. Właścicielem
      // tej asercji jest test "SEDNO" niżej, który porównuje kafelek z
      // uprawnieniem.
      const first = await activateApplication(MANIFEST_CODE)
      expect(first?.isActive).toBe(true)
      expect(first?.activatedAt).not.toBeNull()

      const activatedCandidates = await listUnactivatedNativeApplications()
      expect(activatedCandidates.map((row) => row.code)).not.toContain(MANIFEST_CODE)

      // Drugie wywołanie (np. drugi klik/drugi request na wyścigu): no-op,
      // zwraca wiersz NIE ZMIENIONY — nie rzuca, nie podwaja aktywacji.
      const second = await activateApplication(MANIFEST_CODE)
      expect(second?.activatedAt?.getTime()).toBe(first?.activatedAt?.getTime())
    })

    it("activateApplication zwraca null dla nieistniejącego kodu (pomyłka wywołania, nie wyścig)", async () => {
      expect(await activateApplication(`nie-istnieje-${SUFFIX}`)).toBeNull()
    })

    // SEDNO K1b. Przed zmianą activateApplication() ustawiała
    // `showOnHub: true` bezwarunkowo dla każdego wiersza native, więc te dwa
    // przypadki kończyły się identycznie — a cztery kody w rejestrze nie są
    // kafelkami, tylko uprawnieniami. Do K3 trzyma je poza hubem
    // `show_on_hub = excluded.show_on_hub` w seed-system-config.mjs, czyli
    // linia, którą K3 usuwa jako defekt; potem nie zostałoby nic i pierwszy
    // admin przechodzący przez picker "Dodaj aplikację" wystawiłby cztery
    // karty prowadzące do ekranów, które kafelkami nie są.
    //
    // Oba wiersze przechodzą przez tę samą funkcję, w tym samym teście,
    // różniąc się wyłącznie tym, co seed wstawił im na INSERCIE — bo dokładnie
    // to jest teraz jedyną różnicą, jaką aktywacja ma respektować.
    it("SEDNO: aktywacja uprawnienia nie wystawia go na hub, aktywacja kafelka zostawia go widocznym", async () => {
      await getDb()
        .insert(applications)
        .values([
          {
            code: MANIFEST_CODE,
            name: "Prawdziwy kafelek",
            kind: "native",
            route: MANIFEST_ROUTE,
            isActive: false,
            // manifest bez entitlementOnly -> seed wstawia true
            showOnHub: true,
            activatedAt: null,
          },
          {
            code: ENTITLEMENT_CODE,
            name: "Sam grant, bez własnej karty",
            kind: "native",
            route: `/${ENTITLEMENT_CODE}`,
            isActive: false,
            // manifest z entitlementOnly: true -> seed wstawia false
            showOnHub: false,
            activatedAt: null,
          },
        ])

      const tile = await activateApplication(MANIFEST_CODE)
      const entitlement = await activateApplication(ENTITLEMENT_CODE)

      // Aktywacja MUSI zadziałać dla obu — uprawnienie bez `is_active` nadal
      // grantuje (requireTileAccess patrzy wyłącznie na granty), ale wiersz
      // nieaktywny nie pojawia się na liście admina, więc "aktywuj, tylko nie
      // pokazuj" jest jedynym poprawnym wynikiem.
      expect(tile?.isActive).toBe(true)
      expect(entitlement?.isActive).toBe(true)
      expect(tile?.activatedAt).not.toBeNull()
      expect(entitlement?.activatedAt).not.toBeNull()

      expect(tile?.showOnHub).toBe(true)
      expect(entitlement?.showOnHub).toBe(false)

      // Nie sama wartość zwrotna: hub renderuje z listHubApplications()
      // (is_active AND show_on_hub), więc dowodem jest wiersz w bazie.
      const hubCodes = (await listHubApplications()).map((row) => row.code)
      expect(hubCodes).toContain(MANIFEST_CODE)
      expect(hubCodes).not.toContain(ENTITLEMENT_CODE)
    })

    it("updateApplication odrzuca zmianę route/code/kind na już aktywowanym wierszu native", async () => {
      await expect(
        updateApplication(applicationId, { route: "/inna-sciezka" }),
      ).rejects.toBeInstanceOf(NativeApplicationImmutableError)

      await expect(
        updateApplication(applicationId, { code: `${APP_CODE}-zmieniony` }),
      ).rejects.toBeInstanceOf(NativeApplicationImmutableError)

      await expect(
        updateApplication(applicationId, { kind: "external-link", url: "https://example.com" }),
      ).rejects.toBeInstanceOf(NativeApplicationImmutableError)
    })

    it("updateApplication nadal pozwala zmieniać pola hub-renderu (name/color/categoryFunctional/showOnHub) na wierszu native", async () => {
      const updated = await updateApplication(applicationId, {
        name: "Nowa nazwa kafelka",
        color: "violet",
        categoryFunctional: "misc",
        categoryDepartment: ["it"],
        showOnHub: false,
      })

      expect(updated?.name).toBe("Nowa nazwa kafelka")
      expect(updated?.color).toBe("violet")
      expect(updated?.categoryFunctional).toBe("misc")
      expect(updated?.categoryDepartment).toEqual(["it"])
      expect(updated?.showOnHub).toBe(false)
      // route/kind/code NIE dotknięte przez tę edycję.
      expect(updated?.route).toBe(NATIVE_INPUT.route)
      expect(updated?.kind).toBe("native")
    })

    it("updateApplication NIE blokuje zmiany route/kind na wierszu external-link — niezmiennik dotyczy wyłącznie native", async () => {
      const [external] = await getDb()
        .insert(applications)
        .values({
          code: EXTERNAL_APP_CODE,
          name: "Zewnętrzny",
          kind: "external-link",
          url: "https://example.com",
        })
        .returning()

      const updated = await updateApplication(external!.id, {
        url: "https://example.com/inna-sciezka",
      })
      expect(updated?.url).toBe("https://example.com/inna-sciezka")
    })

    // SEDNO tego fixa: druga, dotąd nieogrodzona droga do kind="native" —
    // PATCH na JUŻ ISTNIEJĄCYM wierszu external-link/iframe ustawiający
    // kind:"native" (dowiezione live na produkcyjnym wierszu meeting-guru
    // podczas review). createApplication blokuje kind="native" wyłącznie przy
    // TWORZENIU (NativeCreationNotAllowedError); assertNativeApplicationImmutable
    // pilnowała dotąd wyłącznie wierszy JUŻ natywnych
    // (`if (existing.kind !== "native") return` — cichy no-op dla reszty), więc
    // ta konkretna promocja przechodziła bez błędu i tworzyła wiersz native z
    // wymyśloną trasą, bez żadnego kodu za nią — dokładnie ta luka, przed którą
    // ma bronić D6-rewizja.
    it("SEDNO: odrzuca PATCH promujący ISTNIEJĄCY external-link do kind=native", async () => {
      const [external] = await getDb()
        .insert(applications)
        .values({
          code: EXTERNAL_APP_CODE,
          name: "Zewnętrzny (kandydat na promocję)",
          kind: "external-link",
          url: "https://chat.megu.me",
        })
        .returning()

      await expect(
        updateApplication(external!.id, { kind: "native", route: "/sciezka-znikad" }),
      ).rejects.toBeInstanceOf(NativeApplicationImmutableError)

      const [row] = await getDb()
        .select()
        .from(applications)
        .where(eq(applications.id, external!.id))
      expect(row!.kind).toBe("external-link")
      expect(row!.route).toBeNull()
      expect(row!.url).toBe("https://chat.megu.me")
    })

    // Krok 5 (PROJECT/cortex-frontend-hub-db-driven-projekt.md — "rozróżnienie
    // wizualne na liście Aplikacje"): wiersz native bez historii aktywacji
    // (activated_at is null) żyje WYŁĄCZNIE w listUnactivatedNativeApplications()
    // — nigdy nie powinien pojawić się na liście admina (listApplications(),
    // konsument GET /api/system-config/applications). Dowód na dokładnie to
    // rozróżnienie na JEDNYM wierszu przez cały cykl życia: nigdy-nieaktywowany
    // (niewidoczny) -> aktywowany (widoczny) -> ręcznie wyłączony (WCIĄŻ
    // widoczny — zwykły wyszarzony wiersz, jak dziś, `691da0c`).
    //
    // Kontrolą negatywną jest CONTROL_CODE — własny, jednorazowy, JUŻ
    // aktywowany wiersz (patrz komentarz przy jego deklaracji) — celowo NIE
    // `system-config` (dzielony singleton, potencjalnie dotknięty przez inną
    // suitę integracyjną równolegle na tej samej bazie) ani `APP_CODE` z
    // fixture'a tego pliku (`NATIVE_INPUT`, linia ok. 129, nie ustawia
    // `activatedAt`, więc TEN konkretny testowy wiersz jest, ubocznie, sam w
    // sobie "nigdy nieaktywowany" — poprawnie znikałby z listy, co dowodzi
    // tego samego mechanizmu jeszcze raz, ale myliłoby czytelnika jako
    // "kontrolę").
    it("listApplications pomija native bez activated_at, ale widzi aktywowany-a-potem-wyłączony wiersz", async () => {
      await getDb().insert(applications).values({
        code: MANIFEST_CODE,
        name: "Nigdy nieaktywowany moduł",
        kind: "native",
        route: MANIFEST_ROUTE,
        isActive: false,
        showOnHub: false,
        activatedAt: null,
      })
      await getDb()
        .insert(applications)
        .values({
          code: CONTROL_CODE,
          name: "Kontrola — już aktywowany",
          kind: "native",
          route: `/${CONTROL_CODE}`,
          isActive: true,
          showOnHub: true,
          activatedAt: new Date(),
        })

      const beforeActivation = (await listApplications()).map((row) => row.code)
      expect(beforeActivation).not.toContain(MANIFEST_CODE)
      expect(beforeActivation).toContain(CONTROL_CODE)

      const activated = await activateApplication(MANIFEST_CODE)
      expect(activated?.activatedAt).not.toBeNull()

      const afterActivation = (await listApplications()).map((row) => row.code)
      expect(afterActivation).toContain(MANIFEST_CODE)

      // Ręczne wyłączenie PO aktywacji zostawia activated_at nietknięte —
      // wiersz musi zostać widoczny, nie zniknąć z powrotem.
      await updateApplication(activated!.id, { isActive: false })
      const afterDeactivation = (await listApplications()).map((row) => row.code)
      expect(afterDeactivation).toContain(MANIFEST_CODE)
    })
  })

  // Licencjonowanie modułów instancji (ENABLED_MODULES,
  // PROJECT/cortex-frontend-module-licensing-mvp.md D1/D2/D3). Bramka
  // WYŁĄCZNIE nad listUnactivatedNativeApplications() — nigdy nad
  // listApplications()/listHubApplications(), świadomy zakres udokumentowany
  // w design docu (D2: activated_at is null już wyklucza legacy/rdzeń z tego
  // zapytania, więc allowlista dotyka wyłącznie świeżych kandydatów; D3:
  // już aktywowany wiersz spoza listy NIE znika automatycznie z huba).
  describe("ENABLED_MODULES — allowlista kandydatów w listUnactivatedNativeApplications i bramka aktywacji", () => {
    const ALLOWED_CODE = `licencja-dozwolony-${SUFFIX}`
    const BLOCKED_CODE = `licencja-zablokowany-${SUFFIX}`

    // `showOnHub: true` — oba wiersze to zwykłe kafelki, więc od K1b tak
    // właśnie zostawia je rejestracja (seed-tile-manifests.mjs bierze tę
    // kolumnę z manifestowego `entitlementOnly`, a nie ze stałej).
    //
    // Testy w tym bloku NIE asertują na showOnHub, choć przed K1b asertowały:
    // aktywacja do tej kolumny nie pisze, więc taka asercja mierzyłaby już
    // tylko fixture. Ta suita odpowiada za bramkę ENABLED_MODULES; za
    // "uprawnienie nie ląduje na hubie, kafelek ląduje" odpowiada test SEDNO
    // w bloku D6-rewizja/D10-rewizja d wyżej.
    beforeEach(async () => {
      await getDb()
        .insert(applications)
        .values([
          {
            code: ALLOWED_CODE,
            name: "Moduł dozwolony przez allowlistę",
            kind: "native",
            route: `/${ALLOWED_CODE}`,
            isActive: false,
            showOnHub: true,
            activatedAt: null,
          },
          {
            code: BLOCKED_CODE,
            name: "Moduł spoza allowlisty",
            kind: "native",
            route: `/${BLOCKED_CODE}`,
            isActive: false,
            showOnHub: true,
            activatedAt: null,
          },
        ])
    })

    afterEach(async () => {
      vi.unstubAllEnvs()
      await getDb().delete(applications).where(eq(applications.code, ALLOWED_CODE))
      await getDb().delete(applications).where(eq(applications.code, BLOCKED_CODE))
    })

    it("ENABLED_MODULES nieustawione -> widoczni obaj kandydaci (bez ograniczeń, dzisiejsze zachowanie)", async () => {
      const codes = (await listUnactivatedNativeApplications()).map((row) => row.code)
      expect(codes).toContain(ALLOWED_CODE)
      expect(codes).toContain(BLOCKED_CODE)
    })

    it("ENABLED_MODULES ustawione -> widoczny wyłącznie kod na liście", async () => {
      vi.stubEnv("ENABLED_MODULES", ALLOWED_CODE)

      const codes = (await listUnactivatedNativeApplications()).map((row) => row.code)
      expect(codes).toContain(ALLOWED_CODE)
      expect(codes).not.toContain(BLOCKED_CODE)
    })

    it("wiersz spoza listy, ale JUŻ AKTYWOWANY, nie jest już kandydatem niezależnie od allowlisty — i nie znika z listApplications() (D3: poza zakresem tej bramki)", async () => {
      await activateApplication(BLOCKED_CODE)
      vi.stubEnv("ENABLED_MODULES", ALLOWED_CODE)

      const candidates = (await listUnactivatedNativeApplications()).map((row) => row.code)
      expect(candidates).not.toContain(BLOCKED_CODE)

      const allApplications = (await listApplications()).map((row) => row.code)
      expect(allApplications).toContain(BLOCKED_CODE)
    })

    async function rowOf(code: string) {
      const [row] = await getDb().select().from(applications).where(eq(applications.code, code))
      return row!
    }

    // SEDNO D9 (PROJECT/cortex-frontend-licencjonowanie-projekt.md §1.1):
    // filtr listy chronił WYŁĄCZNIE odczyt. Wiersz kandydata istnieje w bazie
    // niezależnie od allowlisty (wstawia go seed-tile-manifests.mjs), więc
    // activateApplication() na tym samym kodzie, który picker poprawnie ukrywa,
    // aktywował moduł spoza licencji. Ten test padał przed fixem: zwracał
    // isActive=true i ustawiony activated_at.
    it("SEDNO: activateApplication odrzuca kod spoza allowlisty — ten sam kod, którego picker nie pokazuje", async () => {
      vi.stubEnv("ENABLED_MODULES", ALLOWED_CODE)

      const candidates = (await listUnactivatedNativeApplications()).map((row) => row.code)
      expect(candidates).not.toContain(BLOCKED_CODE)

      await expect(activateApplication(BLOCKED_CODE)).rejects.toBeInstanceOf(ModuleNotLicensedError)
    })

    // D4 — "licencja NIGDY nie zapisuje do danych instancji". Porównanie CAŁEGO
    // wiersza, nie samej wartości zwrotnej: gdyby bramka stanęła po UPDATE
    // zamiast przed nim, wartość zwrotna i tak byłaby wyjątkiem, a dane
    // instancji już zmienione (is_active/show_on_hub/activated_at/updated_at).
    it("odmowa nie dotyka wiersza w bazie — ani jednego pola", async () => {
      const before = await rowOf(BLOCKED_CODE)
      vi.stubEnv("ENABLED_MODULES", ALLOWED_CODE)

      await expect(activateApplication(BLOCKED_CODE)).rejects.toThrow(/nie jest objęty licencją/)

      expect(await rowOf(BLOCKED_CODE)).toEqual(before)
    })

    it("kod NA allowliście aktywuje się normalnie (bramka nie blokuje zalicencjonowanych)", async () => {
      vi.stubEnv("ENABLED_MODULES", `jakis-inny-modul, ${ALLOWED_CODE} ,i-jeszcze-inny`)

      const activated = await activateApplication(ALLOWED_CODE)

      // showOnHub celowo poza asercjami — patrz komentarz przy beforeEach.
      expect(activated?.isActive).toBe(true)
      expect(activated?.activatedAt).not.toBeNull()
      expect((await rowOf(ALLOWED_CODE)).activatedAt).not.toBeNull()
    })

    // Centralna obietnica MVP: instancja, która NIE opt-inuje, nie widzi żadnej
    // różnicy. Ten sam kod, który przy ustawionej allowliście dostaje odmowę,
    // przy nieustawionej aktywuje się dokładnie jak dotąd.
    it("ENABLED_MODULES nieustawione -> aktywacja działa jak dotąd (backward compatible)", async () => {
      const activated = await activateApplication(BLOCKED_CODE)

      // showOnHub celowo poza asercjami — patrz komentarz przy beforeEach.
      expect(activated?.isActive).toBe(true)
      expect(activated?.activatedAt).not.toBeNull()
    })

    it("ENABLED_MODULES puste/same przecinki -> traktowane jak nieustawione", async () => {
      vi.stubEnv("ENABLED_MODULES", " , , ")

      const activated = await activateApplication(BLOCKED_CODE)

      expect(activated?.isActive).toBe(true)
      expect(activated?.activatedAt).not.toBeNull()
    })

    // D3/D4: bramka jest WYŁĄCZNIE o przyszłej aktywacji. Wiersz, który został
    // aktywowany, zanim kod wypadł z allowlisty, zostaje aktywny — odmowa na
    // powtórnym (i tak no-opowym) wywołaniu niczego mu nie cofa.
    it("odmowa na JUŻ AKTYWOWANYM wierszu nie cofa aktywacji", async () => {
      await activateApplication(BLOCKED_CODE)
      const afterActivation = await rowOf(BLOCKED_CODE)
      expect(afterActivation.isActive).toBe(true)

      vi.stubEnv("ENABLED_MODULES", ALLOWED_CODE)
      await expect(activateApplication(BLOCKED_CODE)).rejects.toBeInstanceOf(ModuleNotLicensedError)

      expect(await rowOf(BLOCKED_CODE)).toEqual(afterActivation)
    })

    // Dowód do punktu "bramka nie może odciąć admina od panelu": aktywacja
    // dotyka WYŁĄCZNIE wierszy z activated_at IS NULL, a `system-config` (jak
    // cały rdzeń) ma tę datę ustawioną przez seed-system-config.mjs
    // (`activated_at = now()` na INSERCIE, coalesce na UPDATE). Nie jest więc
    // kandydatem do aktywacji w ogóle — nie ma operacji, którą ta bramka
    // mogłaby mu odmówić, i żaden osobny assertModuleStaysReachable nie jest tu
    // potrzebny.
    it("rdzeń (system-config) nie jest kandydatem do aktywacji, więc bramka nie ma jak go odciąć", async () => {
      vi.stubEnv("ENABLED_MODULES", ALLOWED_CODE)

      const candidates = (await listUnactivatedNativeApplications()).map((row) => row.code)
      expect(candidates).not.toContain(SYSTEM_CONFIG_APP_CODE)

      const core = await rowOf(SYSTEM_CONFIG_APP_CODE)
      expect(core.activatedAt).not.toBeNull()
      expect(core.isActive).toBe(true)
    })
  })

  // K4/D5 (PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/cortex-frontend-
  // konsolidacja-rejestrow-kafelka-projekt.md). Formularz "Dodaj aplikację" nie
  // ma pola kolejności, więc `input.sortOrder` z panelu jest ZAWSZE undefined —
  // przy `?? 0` każdy nowy link zewnętrzny lądował na pozycji 0, czyli PRZED
  // wszystkimi kafelkami huba (`orderBy asc(sortOrder), asc(code)`).
  //
  // Przypadku PUSTEJ tabeli tu nie ma i mieć nie może: ta baza jest dzielona z
  // seedem i równoległymi suitami, więc nigdy nie jest pusta. Dowodzi go test
  // jednostkowy nextSortOrder(null) w system-config.schema.test.ts.
  describe("K4/D5 — nowa aplikacja z panelu ląduje na końcu listy", () => {
    const FIRST_CODE = `koniec-listy-a-${SUFFIX}`
    const SECOND_CODE = `koniec-listy-b-${SUFFIX}`
    const EXPLICIT_CODE = `koniec-listy-jawny-${SUFFIX}`
    const NEW_CODES = [FIRST_CODE, SECOND_CODE, EXPLICIT_CODE]

    afterEach(async () => {
      await getDb().delete(applications).where(inArray(applications.code, NEW_CODES))
    })

    /** Dokładnie to, co wysyła formularz dla kafelka nienatywnego: BEZ pola
     *  kolejności (chyba że test sprawdza właśnie jawną wartość). */
    function externalInput(code: string, sortOrder?: number) {
      return {
        code,
        name: `Link zewnętrzny ${code}`,
        kind: "external-link" as const,
        url: `https://example.com/${code}`,
        ...(sortOrder === undefined ? {} : { sortOrder }),
      }
    }

    /** Maksimum po CAŁEJ tabeli, nie po liście admina — nowy wiersz ma być za
     *  wszystkim, także za zarejestrowanym, jeszcze nieaktywowanym kandydatem
     *  native, którego listApplications() nie pokazuje. */
    async function highestSortOrder(): Promise<number | null> {
      const [row] = await getDb()
        .select({ value: max(applications.sortOrder) })
        .from(applications)
      return row?.value ?? null
    }

    it("SEDNO: nowy wiersz dostaje max(sort_order) + 10, nie 0 — ląduje ZA każdym istniejącym", async () => {
      const highestBefore = await highestSortOrder()
      expect(highestBefore).not.toBeNull()

      const created = await createApplication(externalInput(FIRST_CODE))

      expect(created.sortOrder).toBe(highestBefore! + 10)

      const all = await getDb()
        .select({ code: applications.code, sortOrder: applications.sortOrder })
        .from(applications)
      const others = all.filter((row) => row.code !== FIRST_CODE)
      expect(Math.max(...others.map((row) => row.sortOrder))).toBeLessThan(created.sortOrder)
    })

    it("druga aplikacja ląduje za pierwszą — kolejne wpisy nie zbijają się na jednej pozycji", async () => {
      const first = await createApplication(externalInput(FIRST_CODE))
      const second = await createApplication(externalInput(SECOND_CODE))

      expect(second.sortOrder).toBe(first.sortOrder + 10)
    })

    // `sortOrder` jest polem kontraktu zapisu (applicationFieldsSchema), więc
    // "koniec listy" znaczy WYŁĄCZNIE "wołający nie podał pozycji". Wartość
    // celowo dużo niższa od maksimum — gdyby reguła nadpisywała jawne wejście,
    // wiersz i tak wylądowałby na końcu i test by to zobaczył.
    it("jawny sortOrder wygrywa nad regułą końca listy", async () => {
      const created = await createApplication(externalInput(EXPLICIT_CODE, 7))

      expect(created.sortOrder).toBe(7)
    })

    // Dowód na tym, co realnie renderuje hub (listHubApplications), a nie na
    // samej wartości kolumny — bo defekt był widoczny właśnie w kolejności kart.
    it("hub renderuje nowy kafelek NA KOŃCU, za wszystkim, co już na nim było", async () => {
      const before = (await listHubApplications()).map((row) => row.code)
      expect(before.length).toBeGreaterThan(0)

      await createApplication(externalInput(FIRST_CODE))

      const after = (await listHubApplications()).map((row) => row.code)
      const position = after.indexOf(FIRST_CODE)
      expect(position).toBeGreaterThanOrEqual(0)

      // Porównanie do wierszy Z MIGAWKI sprzed utworzenia, a nie do całej listy
      // po: równoległe suity integracyjne dokładają i kasują własne kafelki na
      // tej samej bazie, więc asercja "ostatni indeks" byłaby losowa. Wiersz
      // zniknięty w międzyczasie jest pomijany, nie zgadywany.
      for (const code of before) {
        const earlier = after.indexOf(code)
        if (earlier === -1) continue
        expect(earlier).toBeLessThan(position)
      }
    })
  })
})
