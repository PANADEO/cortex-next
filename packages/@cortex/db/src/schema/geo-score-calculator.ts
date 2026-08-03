// Schemat modułu GEO Score Calculator — port analizatora tekstów prasowych
// (~/REPO/geo_calc, PoC Streamlit) na natywny kafelek. Dwie tabele: config
// (singleton — wagi/benchmarki/progi/listy słów) i calculations (historia
// per-user). Mikroserwis Python (services/geo-score-calculator/) jest
// BEZSTANOWY — czyta config Z ŻĄDANIA, nie z tej bazy (PROJECT/
// cortex-frontend-geo-score-calculator-port-projekt.md D3).
//
// Faza 0 (fundament): tylko schemat + migracja + seed defaultów configu.
// Logika serwisowa dotykająca tych tabel (config CRUD, zapis/odczyt historii)
// jest Fazą 1+, poza zakresem tej zmiany — kiedy powstanie, ma żyć w
// @cortex/service/src/geo-score-calculator.ts (code-service, "Rekordy
// per-user"), NIGDY w app/idp/lib/geo-score-calculator/ — ten drugi folder
// jest zarezerwowany dla kodu, który nigdy nie dotyka Drizzle (adapter do
// mikroserwisu, config env var).
//
// POPRAWKA WZGLĘDEM PIERWOTNEGO SZKICU DESIGN DOC (§3): kolumna właściciela
// rekordu w `calculations` to `userEmail`, NIE `createdBy`, jak pierwotny
// szkic dokumentu projektowego pokazywał w swoim przykładzie schematu. Powód:
// uniwersalny wzorzec "Rekordy per-user" spisany w code-service/SKILL.md
// (03.08.2026, ustalony PO napisaniu design doc, na wyraźną prośbę Alexa
// właśnie PRZY OKAZJI tej decyzji) rozróżnia dwa różne byty —
// `userEmail` jest FILTREM WIDOCZNOŚCI (czyje dane w ogóle wracają z
// zapytania: `.where(eq(calculations.userEmail, callerEmail))` w KAŻDYM
// zapytaniu serwisowym), podczas gdy `createdBy` (np.
// `ilustromat.frame_templates.created_by`) jest tylko śladem audytowym na
// zasobie WSPÓŁDZIELONYM między userami. Historia kalkulatora GEO Score jest
// prywatna per user (Alex, 03.08.2026, otwarte pytanie #4 design doc) — to
// jest dokładnie ten pierwszy przypadek, nie drugi.

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const geoScoreCalculator = pgSchema("geo_score_calculator")

export const GRADES = ["A", "B", "C", "D", "F"] as const
export type Grade = (typeof GRADES)[number]

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()

/**
 * Konfiguracja — SINGLETON. `id boolean primaryKey default(true)` wymusza
 * dokładnie jeden wiersz (drugi INSERT koliduje z PK na `true`) bez osobnej
 * tabeli-flagi czy triggera — ten sam trik co w design doc §3.
 *
 * Walidacja "suma wag = 100%" żyje w Zod na warstwie code-api (Faza 3,
 * ustawienia) — CHECK na dokładną równość zmiennoprzecinkową w Postgresie
 * byłby kruchy (design doc §3, komentarz przy oryginalnym szkicu schematu).
 */
export const config = geoScoreCalculator.table("config", {
  id: boolean("id").primaryKey().default(true),
  weightStatistics: doublePrecision("weight_statistics").notNull(),
  weightActionVerbs: doublePrecision("weight_action_verbs").notNull(),
  weightStructure: doublePrecision("weight_structure").notNull(),
  weightObjectivity: doublePrecision("weight_objectivity").notNull(),
  benchmarkStats: doublePrecision("benchmark_stats").notNull(),
  benchmarkVerbs: doublePrecision("benchmark_verbs").notNull(),
  benchmarkStructure: doublePrecision("benchmark_structure").notNull(),
  benchmarkObjectivity: doublePrecision("benchmark_objectivity").notNull(),
  gradeAMin: integer("grade_a_min").notNull(),
  gradeBMin: integer("grade_b_min").notNull(),
  gradeCMin: integer("grade_c_min").notNull(),
  gradeDMin: integer("grade_d_min").notNull(),
  actionVerbs: text("action_verbs").array().notNull(),
  subjectiveWords: text("subjective_words").array().notNull(),
  falsePositives: text("false_positives").array().notNull(),
  bulletPatterns: text("bullet_patterns").array().notNull(),
  updatedAt,
  updatedBy: text("updated_by").notNull(),
})

/**
 * Historia analiz — rekordy PER-USER (code-service/SKILL.md "Rekordy
 * per-user"). `userEmail` musi być wpisany w `.where()` KAŻDEGO zapytania
 * serwisowego czytającego/usuwającego wiersze tej tabeli (Faza 1+) — nie
 * jest to opcjonalny filtr do dołożenia później.
 *
 * Kształt płaskie-kolumny-do-sortowania + `jsonb` na resztę: te same 4
 * `*Score` + `totalScore`/`grade` co design doc §3 istnieją WYŁĄCZNIE dla
 * sortowania/filtrowania w przyszłym `CortexDataGrid` (Faza 2). Znalezione
 * frazy, ich pozycje w tekście i rekomendacje żyją w `result` (pełna
 * odpowiedź POST /analyze) — bez ręcznego JSON.stringify/parse na każdym
 * polu jak w 27-kolumnowym legacy SQLite (§1.3).
 */
export const calculations = geoScoreCalculator.table(
  "calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    textContent: text("text_content").notNull(),
    textPreview: text("text_preview").notNull(),
    wordCount: integer("word_count").notNull(),
    totalScore: doublePrecision("total_score").notNull(),
    grade: text("grade").notNull(),
    statsScore: doublePrecision("stats_score").notNull(),
    verbsScore: doublePrecision("verbs_score").notNull(),
    structureScore: doublePrecision("structure_score").notNull(),
    objectivityScore: doublePrecision("objectivity_score").notNull(),
    result: jsonb("result").notNull(),
    configSnapshot: jsonb("config_snapshot").notNull(),
    createdAt,
  },
  (table) => ({
    gradeAllowed: check("calculations_grade_allowed", sql`${table.grade} in ('A','B','C','D','F')`),
    // Każde zapytanie tego modułu filtruje po userEmail i sortuje po
    // createdAt — dokładnie ta para kolumn, dokładnie w tej kolejności
    // (code-service/SKILL.md "Rekordy per-user", przykład referencyjny).
    byUserCreatedAt: index("calculations_user_email_created_at_idx").on(
      table.userEmail,
      table.createdAt,
    ),
  }),
)

export type ConfigRow = typeof config.$inferSelect
export type ConfigInsert = typeof config.$inferInsert
export type CalculationRow = typeof calculations.$inferSelect
export type CalculationInsert = typeof calculations.$inferInsert
