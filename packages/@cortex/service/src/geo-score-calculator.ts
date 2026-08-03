// Logika modułu GEO Score Calculator (code-service) — Faza 1: odczyt configu
// (singleton) i zapis wyniku analizy do historii. Kontroler w
// app/api/geo-score-calculator/analyze/route.ts tylko waliduje wejście i
// woła to; sam mikroserwis Python jest wołany z osobnego adaptera
// (app/idp/lib/geo-score-calculator/integration-client.ts, code-integration)
// — ten plik dotyka WYŁĄCZNIE Drizzle/Postgres, zero fetch().
//
// "Rekordy per-user" (code-service/SKILL.md): `userEmail` jest OBOWIĄZKOWYM,
// pierwszym parametrem pozycyjnym KAŻDEJ funkcji tego pliku dotykającej
// `calculations`, pochodzi WYŁĄCZNIE z `access.email` zwróconego przez
// requireTileAccess() w kontrolerze — nigdy z ciała/query żądania. Filtr
// jest częścią zapytania (`.where()`), nigdy osobnym krokiem po fetchu —
// `getMyCalculation`/`deleteMyCalculation` zwracają `undefined`/`false`
// zarówno dla "nie istnieje", jak i "cudze"; wołający (route) mapuje oba na
// 404, NIGDY 403 (403 zdradzałby, że rekord o tym id w ogóle istnieje).
//
// Faza 2 (Historia, PROJECT/cortex-frontend-geo-score-calculator-port-
// projekt.md §5): listMyCalculations()/getMyCalculation()/
// deleteMyCalculation() dochodzą tutaj. ŻADEN zapis do `config` (Faza 3,
// Ustawienia) nie wchodzi w tej rundzie.

import { calculations, config, getDb, type CalculationRow, type ConfigRow, type Grade } from "@cortex/db"
import { and, desc, eq } from "drizzle-orm"

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

/** Lista historii WYŁĄCZNIE właściciela, najnowsze pierwsze. Bez page/sort/
 *  search — `CortexDataGrid` (ekran /geo-score-calculator/history) filtruje/
 *  sortuje po stronie przeglądarki nad całą (już przefiltrowaną do usera)
 *  tablicą, wzorem `listMyJobs()`/`listMyArchive()` (code-service/SKILL.md
 *  pkt 4). */
export function listMyCalculations(userEmail: string): Promise<CalculationRow[]> {
  return getDb()
    .select()
    .from(calculations)
    .where(eq(calculations.userEmail, userEmail))
    .orderBy(desc(calculations.createdAt))
}

/** Szczegóły JEDNEJ kalkulacji — właścicielstwo w WHERE, nie sprawdzane po
 *  fetchu. `undefined` zarówno dla "nie istnieje", jak i "cudze" — route
 *  mapuje oba na 404, NIGDY 403. */
export async function getMyCalculation(
  userEmail: string,
  id: string,
): Promise<CalculationRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(calculations)
    .where(and(eq(calculations.id, id), eq(calculations.userEmail, userEmail)))
  return row
}

/** `boolean`, nie rekord — usunięcie cudzej/nieistniejącej kalkulacji zwraca
 *  `false`, wołający mapuje na 404, nigdy 403 (jak wyżej). */
export async function deleteMyCalculation(userEmail: string, id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(calculations)
    .where(and(eq(calculations.id, id), eq(calculations.userEmail, userEmail)))
    .returning()
  return deleted.length > 0
}
