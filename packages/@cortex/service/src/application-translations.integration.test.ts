// Tłumaczenia nazw kafelków na PRAWDZIWYM Postgresie — PROJECT/cortex-frontend/
// ARTIFACTS/i18n/cortex-frontend-tlumaczenia-nazw-kafelkow-projekt.md, Kroki 1-2.
//
// Cztery własności, których NIE DA SIĘ udowodnić bez bazy, bo mieszkają w
// SQL-u, a nie w TypeScripcie:
//  1. kształt odpowiedzi (`toEqual` na pełnym ciele, nie na wybranych polach),
//  2. kasowanie wiersza, w którym po scaleniu nie została ani jedna wartość,
//  3. częściowość mapy na DWÓCH poziomach (język i pole),
//  4. ON DELETE CASCADE — tłumaczenie bez aplikacji nie znaczy nic.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/application-translations.integration.test.ts
//
// Test NIE czyści cudzych danych: zakłada własne wiersze z unikatowym
// przyrostkiem i kasuje wyłącznie je (patrz system-config.integration.test.ts —
// sam Date.now() kolidował przy równoległym starcie kilku plików).

import { applicationTranslations, applications, closeDb, getDb } from "@cortex/db"
import { and, eq, inArray } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import {
  deleteApplication,
  getApplication,
  listHubApplications,
  updateApplication,
} from "./system-config"

const hasDatabase = Boolean(process.env.DATABASE_URL)

const SUFFIX = `tr-itest-${process.pid}-${randomUUID().slice(0, 8)}`
const CODE = `kafelek-${SUFFIX}`
const OTHER_CODE = `kafelek-bez-tlumaczen-${SUFFIX}`
const ALL_CODES = [CODE, OTHER_CODE]

let applicationId = ""
let otherApplicationId = ""

async function cleanup(): Promise<void> {
  // Tłumaczenia lecą kaskadą razem z aplikacją — jawny DELETE tylko po to,
  // żeby sprzątanie nie zależało od własności, którą ten plik testuje.
  const db = getDb()
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(inArray(applications.code, ALL_CODES))
  if (rows.length > 0) {
    await db.delete(applicationTranslations).where(
      inArray(
        applicationTranslations.applicationId,
        rows.map((row) => row.id),
      ),
    )
  }
  await db.delete(applications).where(inArray(applications.code, ALL_CODES))
}

/** Świeży wiersz kafelka BEZ ani jednego tłumaczenia — punkt startowy każdego
 *  testu niżej. Zakładany od nowa w `beforeEach`, żeby kolejność testów nie
 *  niosła stanu. */
async function seedFixture(): Promise<void> {
  const db = getDb()
  const [application] = await db
    .insert(applications)
    .values({
      code: CODE,
      name: "Analizator faktur",
      description: "Wyciąga dane z faktur",
      kind: "native",
      route: `/${CODE}`,
      isActive: true,
      showOnHub: true,
      sortOrder: 7,
    })
    .returning()
  applicationId = application!.id

  const [other] = await db
    .insert(applications)
    .values({
      code: OTHER_CODE,
      name: "Kafelek bez tłumaczeń",
      kind: "native",
      route: `/${OTHER_CODE}`,
      isActive: true,
      showOnHub: true,
      sortOrder: 8,
    })
    .returning()
  otherApplicationId = other!.id
}

async function translationRows() {
  return getDb()
    .select()
    .from(applicationTranslations)
    .where(eq(applicationTranslations.applicationId, applicationId))
}

describe.skipIf(!hasDatabase)("tłumaczenia kafelków — prawdziwy Postgres", () => {
  beforeEach(async () => {
    await cleanup()
    await seedFixture()
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  describe("kształt odpowiedzi", () => {
    it("kafelek BEZ tłumaczeń dostaje pustą mapę, nigdy undefined — pełne ciało", async () => {
      const row = await getApplication(otherApplicationId)

      // toEqual na CAŁYM obiekcie, nie na wybranych polach: kontrakt uzgodniony
      // z warstwą kliencką obejmuje komplet, a asercja punktowa przepuściłaby
      // pole zgubione po drodze.
      expect(row).toEqual({
        id: otherApplicationId,
        code: OTHER_CODE,
        name: "Kafelek bez tłumaczeń",
        description: null,
        icon: null,
        category: null,
        kind: "native",
        route: `/${OTHER_CODE}`,
        url: null,
        target: null,
        isActive: true,
        sortOrder: 8,
        showOnHub: true,
        color: null,
        categoryFunctional: null,
        categoryDepartment: null,
        activatedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        translations: {},
      })
    })

    it("zwraca KOMPLET języków, a nie nazwę rozstrzygniętą przez serwer", async () => {
      await updateApplication(applicationId, {
        translations: {
          en: { name: "Invoice Analyser", description: "Extracts data from invoices" },
          pl: { name: "Analizator faktur (wariant)", description: null },
        },
      })

      const row = await getApplication(applicationId)

      // Kluczowe: `name` zostaje wartością BAZOWĄ. Serwer nie zna języka
      // użytkownika (wybór siedzi w localStorage), więc nie ma prawa podmienić
      // tego pola — regułę stosuje klient.
      expect(row?.name).toBe("Analizator faktur")
      expect(row?.description).toBe("Wyciąga dane z faktur")
      expect(row?.translations).toEqual({
        en: { name: "Invoice Analyser", description: "Extracts data from invoices" },
        pl: { name: "Analizator faktur (wariant)", description: null },
      })
    })

    it("listHubApplications() niesie ten sam kształt co szczegóły", async () => {
      await updateApplication(applicationId, {
        translations: { en: { name: "Invoice Analyser" } },
      })

      const hub = await listHubApplications()
      const mine = hub.filter((row) => row.code === CODE)

      // DOKŁADNIE RAZ, mimo dwóch wierszy tłumaczeń dla innych kafelków w tej
      // samej tabeli — dowód, że doklejanie nie zwielokrotnia wierszy katalogu
      // (obala fan-out z JOIN-a bez grupowania).
      expect(mine).toHaveLength(1)
      expect(mine[0]?.translations).toEqual({
        en: { name: "Invoice Analyser", description: null },
      })
      expect(hub.find((row) => row.code === OTHER_CODE)?.translations).toEqual({})
    })

    it("kafelek z DWOMA językami pojawia się na liście dokładnie raz", async () => {
      await updateApplication(applicationId, {
        translations: { en: { name: "Invoice Analyser" }, pl: { name: "Faktury" } },
      })

      const mine = (await listHubApplications()).filter((row) => row.code === CODE)

      expect(mine).toHaveLength(1)
      expect(Object.keys(mine[0]!.translations).sort()).toEqual(["en", "pl"])
    })
  })

  describe("pusty napis to NULL, a wiersz bez ani jednej wartości znika", () => {
    it("pusty napis ląduje w bazie jako NULL, nie jako pusty tekst", async () => {
      await updateApplication(applicationId, {
        translations: { en: { name: "Invoice Analyser", description: "" } },
      })

      expect(await translationRows()).toEqual([
        expect.objectContaining({ locale: "en", name: "Invoice Analyser", description: null }),
      ])
    })

    it("wyczyszczenie OBU pól KASUJE wiersz, zamiast zostawiać pusty rekord", async () => {
      await updateApplication(applicationId, {
        translations: { en: { name: "Invoice Analyser", description: "Extracts data" } },
      })
      expect(await translationRows()).toHaveLength(1)

      await updateApplication(applicationId, {
        translations: { en: { name: "", description: "" } },
      })

      // Nie "wiersz z dwoma NULL-ami", tylko BRAK WIERSZA: pusty rekord
      // wyglądałby dla każdego czytającego jak istniejące tłumaczenie (klucz
      // obecny w mapie `translations`), a nim nie jest.
      expect(await translationRows()).toEqual([])
      expect((await getApplication(applicationId))?.translations).toEqual({})
    })

    it("wyczyszczenie JEDNEGO pola zostawia wiersz przy życiu", async () => {
      await updateApplication(applicationId, {
        translations: { en: { name: "Invoice Analyser", description: "Extracts data" } },
      })

      await updateApplication(applicationId, { translations: { en: { description: null } } })

      expect(await translationRows()).toEqual([
        expect.objectContaining({ locale: "en", name: "Invoice Analyser", description: null }),
      ])
    })

    it("kasowanie nieistniejącego wiersza jest bezszelestne (idempotencja)", async () => {
      await updateApplication(applicationId, { translations: { en: { name: null } } })

      expect(await translationRows()).toEqual([])
    })
  })

  describe("częściowość mapy — na poziomie języka i na poziomie pola", () => {
    beforeEach(async () => {
      await updateApplication(applicationId, {
        translations: {
          en: { name: "Invoice Analyser", description: "Extracts data" },
          pl: { name: "Faktury", description: "Wyciąga dane" },
        },
      })
    })

    it("język nieobecny w mapie zostaje w bazie bez zmian", async () => {
      await updateApplication(applicationId, { translations: { en: { name: "Invoices" } } })

      expect((await getApplication(applicationId))?.translations).toEqual({
        en: { name: "Invoices", description: "Extracts data" },
        pl: { name: "Faktury", description: "Wyciąga dane" },
      })
    })

    it("pole nieobecne we wpisie języka zostaje bez zmian w swoim wierszu", async () => {
      await updateApplication(applicationId, {
        translations: { en: { description: "New description" } },
      })

      expect((await getApplication(applicationId))?.translations.en).toEqual({
        name: "Invoice Analyser",
        description: "New description",
      })
    })

    it("PATCH bez pola translations nie rusza ani jednego wiersza tłumaczeń", async () => {
      await updateApplication(applicationId, { name: "Analizator faktur v2" })

      const row = await getApplication(applicationId)
      expect(row?.name).toBe("Analizator faktur v2")
      expect(row?.translations).toEqual({
        en: { name: "Invoice Analyser", description: "Extracts data" },
        pl: { name: "Faktury", description: "Wyciąga dane" },
      })
    })

    it("PATCH niosący naraz wartość bazową i jej tłumaczenie zapisuje OBIE", async () => {
      const updated = await updateApplication(applicationId, {
        name: "Analizator faktur v3",
        translations: { en: { name: "Invoice Analyser v3" } },
      })

      expect(updated?.name).toBe("Analizator faktur v3")
      expect(updated?.translations.en?.name).toBe("Invoice Analyser v3")
    })

    it("odpowiedź PATCH-a niesie stan PO zapisie, nie sprzed niego", async () => {
      const updated = await updateApplication(applicationId, {
        translations: { en: { name: "Invoices only", description: null } },
      })

      expect(updated?.translations).toEqual({
        en: { name: "Invoices only", description: null },
        pl: { name: "Faktury", description: "Wyciąga dane" },
      })
    })
  })

  describe("ON DELETE CASCADE", () => {
    it("usunięcie kafelka zabiera ze sobą jego tłumaczenia", async () => {
      await updateApplication(applicationId, {
        translations: { en: { name: "Invoice Analyser" }, pl: { name: "Faktury" } },
      })
      expect(await translationRows()).toHaveLength(2)

      await deleteApplication(applicationId)

      const orphans = await getDb()
        .select()
        .from(applicationTranslations)
        .where(eq(applicationTranslations.applicationId, applicationId))
      expect(orphans).toEqual([])
    })

    it("nie rusza tłumaczeń INNYCH kafelków", async () => {
      await updateApplication(applicationId, { translations: { en: { name: "Invoice Analyser" } } })
      await updateApplication(otherApplicationId, { translations: { en: { name: "Other tile" } } })

      await deleteApplication(applicationId)

      const survivors = await getDb()
        .select()
        .from(applicationTranslations)
        .where(
          and(
            eq(applicationTranslations.applicationId, otherApplicationId),
            eq(applicationTranslations.locale, "en"),
          ),
        )
      expect(survivors).toHaveLength(1)
    })
  })

  it("PATCH na nieistniejącym kafelku zwraca null i nie zakłada sierot", async () => {
    const ghost = randomUUID()

    expect(await updateApplication(ghost, { translations: { en: { name: "X" } } })).toBeNull()

    const orphans = await getDb()
      .select()
      .from(applicationTranslations)
      .where(eq(applicationTranslations.applicationId, ghost))
    expect(orphans).toEqual([])
  })
})
