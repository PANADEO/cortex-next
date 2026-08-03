// Logika modułu GEO Score Calculator (code-service) — Faza 1: odczyt configu
// (singleton) i zapis wyniku analizy do historii. Kontroler w
// app/api/geo-score-calculator/analyze/route.ts tylko waliduje wejście i
// woła to; sam mikroserwis Python jest wołany z osobnego adaptera
// (app/idp/lib/geo-score-calculator/integration-client.ts, code-integration)
// — ten plik dotyka WYŁĄCZNIE Drizzle/Postgres, zero fetch().
//
// "Rekordy per-user" (code-service/SKILL.md): `userEmail` jest OBOWIĄZKOWYM,
// pierwszym parametrem pozycyjnym funkcji zapisującej `calculations`,
// pochodzi WYŁĄCZNIE z `access.email` zwróconego przez requireTileAccess()
// w kontrolerze — nigdy z ciała żądania.
//
// Faza 1 celowo NIE zawiera listMyCalculations()/getMyCalculation() (Faza 2,
// ekran Historii) ani żadnego ZAPISU do `config` (Faza 3, Ustawienia) —
// tylko odczyt configu i zapis pojedynczej kalkulacji, dokładnie to, czego
// potrzebuje POST /analyze. Patrz PROJECT/cortex-frontend-geo-score-
// calculator-port-projekt.md §5.

import { calculations, config, getDb, type CalculationRow, type ConfigRow, type Grade } from "@cortex/db"
import { eq } from "drizzle-orm"

export const GEO_SCORE_CALCULATOR_APP_CODE = "geo-score-calculator"

/** Config nie istnieje tylko wtedy, gdy seed nie został uruchomiony — stan
 *  niespójności wdrożenia (patrz packages/@cortex/db/scripts/seed-geo-score-
 *  calculator.mjs), nie coś, na co wołający ma wpływ. Kontroler mapuje to na
 *  500, nie 400/404. */
export class GeoScoreConfigMissingError extends Error {
  constructor() {
    super("Konfiguracja GEO Score Calculator nie istnieje — seed nie został uruchomiony")
    this.name = "GeoScoreConfigMissingError"
  }
}

/** Jeden wiersz, PK wymuszony na `true` w schemacie (singleton) — WHERE tu
 *  jest dokumentacją zamiaru, nie realnym filtrem: drugi wiersz nie może
 *  istnieć. */
export async function getGeoScoreConfig(): Promise<ConfigRow> {
  const [row] = await getDb().select().from(config).where(eq(config.id, true))
  if (!row) throw new GeoScoreConfigMissingError()
  return row
}

const PREVIEW_MAX_CHARS = 200

/** Skrót tekstu do listowania w przyszłej Historii (Faza 2) — liczony tu, a
 *  nie w kontrolerze, żeby definicja "co to jest podgląd" miała jedno
 *  miejsce, niezależnie od tego, kto zapisuje wiersz. */
function toPreview(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > PREVIEW_MAX_CHARS ? `${trimmed.slice(0, PREVIEW_MAX_CHARS)}…` : trimmed
}

export interface SaveCalculationInput {
  textContent: string
  wordCount: number
  totalScore: number
  grade: Grade
  statsScore: number
  verbsScore: number
  structureScore: number
  objectivityScore: number
  /** Pełna odpowiedź POST /analyze (znalezione frazy, ich pozycje,
   *  rekomendacje) — bez ręcznego JSON.stringify/parse na każdym polu jak w
   *  27-kolumnowym legacy SQLite. */
  result: unknown
  /** Migawka configu użytego do TEGO wyniku — audytowalność ("jaką
   *  konfiguracją to policzono"), czego dzisiejszy PoC nie eksponuje mimo że
   *  dane już zapisuje. */
  configSnapshot: unknown
}

/** Zapisuje wynik analizy jako rekord PER-USER. `userEmail` obowiązkowy,
 *  pierwszy — patrz nagłówek pliku i code-service/SKILL.md "Rekordy
 *  per-user". Wołający MUSI przekazać `access.email` z requireTileAccess(),
 *  nigdy pole z body żądania. */
export async function saveGeoScoreCalculation(
  userEmail: string,
  input: SaveCalculationInput,
): Promise<CalculationRow> {
  const [saved] = await getDb()
    .insert(calculations)
    .values({
      userEmail,
      textContent: input.textContent,
      textPreview: toPreview(input.textContent),
      wordCount: input.wordCount,
      totalScore: input.totalScore,
      grade: input.grade,
      statsScore: input.statsScore,
      verbsScore: input.verbsScore,
      structureScore: input.structureScore,
      objectivityScore: input.objectivityScore,
      result: input.result,
      configSnapshot: input.configSnapshot,
    })
    .returning()

  return saved as CalculationRow
}
