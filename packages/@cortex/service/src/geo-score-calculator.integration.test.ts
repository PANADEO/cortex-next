// Historia GEO Score Calculator na PRAWDZIWYM Postgresie — dowód, że filtr
// `userEmail` w .where() (code-service/SKILL.md "Rekordy per-user") faktycznie
// izoluje właściciela od cudzych rekordów, i że listMyCalculations()/
// getMyCalculation()/deleteMyCalculation() faktycznie czytają/kasują wiersze
// zapisane przez saveGeoScoreCalculation() (Faza 1).
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
// Uruchomienie (przeciw izolowanej cortex-next-postgres, NIGDY współdzielonej
// `cortex` — potwierdź `docker ps` przed uruchomieniem):
//   docker ps  # potwierdź cortex-next-postgres, nie shared `cortex`
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex \
//     pnpm --filter @cortex/db db:migrate:geo-score-calculator
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/geo-score-calculator.integration.test.ts

import { calculations, closeDb, getDb } from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  GEO_SCORE_CONFIG_DEFAULTS,
  deleteMyCalculation,
  getGeoScoreConfig,
  getMyCalculation,
  listMyCalculations,
  resetGeoScoreConfig,
  saveGeoScoreCalculation,
  updateGeoScoreConfig,
  type SaveCalculationInput,
  type UpdateGeoScoreConfigInput,
} from "./geo-score-calculator"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Sufiks per proces, wzorem content-guru.integration.test.ts/visual-guru.
// integration.test.ts — testy integracyjne mogą startować równolegle, stałe
// adresy kolidowałyby.
const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const OWNER_EMAIL = `geo-score-owner-${SUFFIX}@e2e.local`
const FOREIGN_OWNER_EMAIL = `geo-score-foreign-${SUFFIX}@e2e.local`

function calculationInput(overrides: Partial<SaveCalculationInput> = {}): SaveCalculationInput {
  return {
    textContent: "Spółka zainwestowała 5 mln w nowy zakład.",
    wordCount: 7,
    totalScore: 82.4,
    grade: "B",
    statsScore: 91,
    verbsScore: 76,
    structureScore: 88,
    objectivityScore: 79,
    result: { totalScore: 82.4, grade: "B" },
    configSnapshot: { weightStatistics: 0.3 },
    ...overrides,
  }
}

async function cleanup() {
  const db = getDb()
  await db.delete(calculations).where(eq(calculations.userEmail, OWNER_EMAIL))
  await db.delete(calculations).where(eq(calculations.userEmail, FOREIGN_OWNER_EMAIL))
}

describe.skipIf(!hasDatabase)("geo-score-calculator service — prawdziwy Postgres", () => {
  beforeEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it("saveGeoScoreCalculation zapisuje wiersz z userEmail i skróconym podglądem", async () => {
    const saved = await saveGeoScoreCalculation(
      OWNER_EMAIL,
      calculationInput({ textContent: "  Krótki tekst do podglądu.  " }),
    )

    expect(saved.userEmail).toBe(OWNER_EMAIL)
    expect(saved.textPreview).toBe("Krótki tekst do podglądu.")
    expect(saved.grade).toBe("B")
  })

  it("listMyCalculations zwraca WYŁĄCZNIE rekordy właściciela, najnowsze pierwsze", async () => {
    const first = await saveGeoScoreCalculation(OWNER_EMAIL, calculationInput({ totalScore: 40, grade: "D" }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    const second = await saveGeoScoreCalculation(OWNER_EMAIL, calculationInput({ totalScore: 90, grade: "A" }))
    await saveGeoScoreCalculation(FOREIGN_OWNER_EMAIL, calculationInput({ totalScore: 10, grade: "F" }))

    const rows = await listMyCalculations(OWNER_EMAIL)

    expect(rows).toHaveLength(2)
    expect(rows.some((row) => row.userEmail === FOREIGN_OWNER_EMAIL)).toBe(false)
    // Najnowsze pierwsze.
    expect(rows[0]?.id).toBe(second.id)
    expect(rows[1]?.id).toBe(first.id)
  })

  it("getMyCalculation zwraca undefined dla cudzego id (nigdy nie przecieka)", async () => {
    const foreign = await saveGeoScoreCalculation(FOREIGN_OWNER_EMAIL, calculationInput())

    const asOwner = await getMyCalculation(OWNER_EMAIL, foreign.id)
    expect(asOwner).toBeUndefined()

    const asForeignOwner = await getMyCalculation(FOREIGN_OWNER_EMAIL, foreign.id)
    expect(asForeignOwner?.id).toBe(foreign.id)
  })

  it("getMyCalculation zwraca undefined dla nieistniejącego id", async () => {
    const result = await getMyCalculation(OWNER_EMAIL, "00000000-0000-0000-0000-000000000000")
    expect(result).toBeUndefined()
  })

  it("getMyCalculation niesie pełny result i configSnapshot dla audytowalności", async () => {
    const saved = await saveGeoScoreCalculation(
      OWNER_EMAIL,
      calculationInput({
        result: { totalScore: 82.4, grade: "B", recommendations: ["Dodaj bullet points"] },
        configSnapshot: { weightStatistics: 0.3, actionVerbs: ["wdrożył"] },
      }),
    )

    const detail = await getMyCalculation(OWNER_EMAIL, saved.id)

    expect(detail?.result).toEqual({ totalScore: 82.4, grade: "B", recommendations: ["Dodaj bullet points"] })
    expect(detail?.configSnapshot).toEqual({ weightStatistics: 0.3, actionVerbs: ["wdrożył"] })
  })

  it("deleteMyCalculation usuwa własny wiersz i zwraca true", async () => {
    const saved = await saveGeoScoreCalculation(OWNER_EMAIL, calculationInput())

    const removed = await deleteMyCalculation(OWNER_EMAIL, saved.id)
    expect(removed).toBe(true)

    const rows = await listMyCalculations(OWNER_EMAIL)
    expect(rows.some((row) => row.id === saved.id)).toBe(false)
  })

  it("deleteMyCalculation zwraca false dla cudzego wiersza i NIE usuwa go", async () => {
    const foreign = await saveGeoScoreCalculation(FOREIGN_OWNER_EMAIL, calculationInput())

    const removed = await deleteMyCalculation(OWNER_EMAIL, foreign.id)
    expect(removed).toBe(false)

    const stillThere = await getMyCalculation(FOREIGN_OWNER_EMAIL, foreign.id)
    expect(stillThere?.id).toBe(foreign.id)
  })

  it("deleteMyCalculation usuwa TYLKO wskazany wiersz, reszta historii właściciela zostaje", async () => {
    const keep = await saveGeoScoreCalculation(OWNER_EMAIL, calculationInput({ totalScore: 55, grade: "C" }))
    const remove = await saveGeoScoreCalculation(OWNER_EMAIL, calculationInput({ totalScore: 20, grade: "F" }))

    await deleteMyCalculation(OWNER_EMAIL, remove.id)

    const rows = await listMyCalculations(OWNER_EMAIL)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(keep.id)
  })
})

// Config jest SINGLETONEM WSPÓLNYM dla całej instancji (design doc D5 §7
// pkt 3 — jeden wiersz, brak per-user scopingu) — w odróżnieniu od bloku
// wyżej (per-process e-maile, zero kolizji między równoległymi uruchomieniami)
// każdy test tu MUSI przywrócić dokładnie to, co zastał (`afterEach`), inaczej
// zostawia instancję w zmutowanym stanie po przebiegu testów.
describe.skipIf(!hasDatabase)("geo-score-calculator service — config (singleton), prawdziwy Postgres", () => {
  let originalConfig: UpdateGeoScoreConfigInput

  beforeAll(async () => {
    const row = await getGeoScoreConfig()
    originalConfig = {
      weightStatistics: row.weightStatistics,
      weightActionVerbs: row.weightActionVerbs,
      weightStructure: row.weightStructure,
      weightObjectivity: row.weightObjectivity,
      benchmarkStats: row.benchmarkStats,
      benchmarkVerbs: row.benchmarkVerbs,
      benchmarkStructure: row.benchmarkStructure,
      benchmarkObjectivity: row.benchmarkObjectivity,
      gradeAMin: row.gradeAMin,
      gradeBMin: row.gradeBMin,
      gradeCMin: row.gradeCMin,
      gradeDMin: row.gradeDMin,
      actionVerbs: row.actionVerbs,
      subjectiveWords: row.subjectiveWords,
      falsePositives: row.falsePositives,
      bulletPatterns: row.bulletPatterns,
    }
  })

  afterEach(async () => {
    await updateGeoScoreConfig("itest-restore@e2e.local", originalConfig)
  })

  it("updateGeoScoreConfig nadpisuje singleton, zapisuje updatedBy, i wynik jest widoczny przy ponownym odczycie", async () => {
    const updated = await updateGeoScoreConfig("analityk@firma.pl", {
      ...GEO_SCORE_CONFIG_DEFAULTS,
      weightStatistics: 0.4,
      weightActionVerbs: 0.2,
      weightStructure: 0.2,
      weightObjectivity: 0.2,
      actionVerbs: ["przetestował"],
    })

    expect(updated.weightStatistics).toBe(0.4)
    expect(updated.updatedBy).toBe("analityk@firma.pl")
    expect(updated.actionVerbs).toEqual(["przetestował"])

    const reread = await getGeoScoreConfig()
    expect(reread.weightStatistics).toBe(0.4)
    expect(reread.actionVerbs).toEqual(["przetestował"])
  })

  it("resetGeoScoreConfig przywraca DOKŁADNIE GEO_SCORE_CONFIG_DEFAULTS (1:1 z Faza 0 seed) po realnej mutacji", async () => {
    await updateGeoScoreConfig("analityk@firma.pl", {
      ...GEO_SCORE_CONFIG_DEFAULTS,
      weightStatistics: 0.1,
      weightActionVerbs: 0.1,
      weightStructure: 0.1,
      weightObjectivity: 0.7,
      gradeAMin: 50,
      actionVerbs: ["zmieniono"],
      subjectiveWords: ["zmieniono"],
      bulletPatterns: ["^zmieniono"],
    })

    const reset = await resetGeoScoreConfig("admin@firma.pl")

    expect(reset.weightStatistics).toBe(GEO_SCORE_CONFIG_DEFAULTS.weightStatistics)
    expect(reset.weightActionVerbs).toBe(GEO_SCORE_CONFIG_DEFAULTS.weightActionVerbs)
    expect(reset.weightStructure).toBe(GEO_SCORE_CONFIG_DEFAULTS.weightStructure)
    expect(reset.weightObjectivity).toBe(GEO_SCORE_CONFIG_DEFAULTS.weightObjectivity)
    expect(reset.benchmarkStats).toBe(GEO_SCORE_CONFIG_DEFAULTS.benchmarkStats)
    expect(reset.benchmarkVerbs).toBe(GEO_SCORE_CONFIG_DEFAULTS.benchmarkVerbs)
    expect(reset.benchmarkStructure).toBe(GEO_SCORE_CONFIG_DEFAULTS.benchmarkStructure)
    expect(reset.benchmarkObjectivity).toBe(GEO_SCORE_CONFIG_DEFAULTS.benchmarkObjectivity)
    expect(reset.gradeAMin).toBe(GEO_SCORE_CONFIG_DEFAULTS.gradeAMin)
    expect(reset.gradeBMin).toBe(GEO_SCORE_CONFIG_DEFAULTS.gradeBMin)
    expect(reset.gradeCMin).toBe(GEO_SCORE_CONFIG_DEFAULTS.gradeCMin)
    expect(reset.gradeDMin).toBe(GEO_SCORE_CONFIG_DEFAULTS.gradeDMin)
    expect(reset.actionVerbs).toEqual(GEO_SCORE_CONFIG_DEFAULTS.actionVerbs)
    expect(reset.subjectiveWords).toEqual(GEO_SCORE_CONFIG_DEFAULTS.subjectiveWords)
    expect(reset.falsePositives).toEqual(GEO_SCORE_CONFIG_DEFAULTS.falsePositives)
    expect(reset.bulletPatterns).toEqual(GEO_SCORE_CONFIG_DEFAULTS.bulletPatterns)
    expect(reset.updatedBy).toBe("admin@firma.pl")
  })
})
