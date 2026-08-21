// KPI dla paska kart nad `/geo-score-calculator/history` (design doc §4.2:
// "liczba analiz, średni wynik, trend"). Czyste funkcje — dane są już w
// całości na kliencie (CortexDataGrid ładuje wszystko naraz, code-service
// SKILL.md pkt 4), więc liczenie tu, bez kolejnego zapytania do API.

export interface HistoryTrend {
  direction: "up" | "down"
  /** Różnica średniej nowszej połowy względem starszej, zaokrąglona do 0.1. */
  delta: number
}

export interface HistoryStats {
  count: number
  averageScore: number | null
  trend: HistoryTrend | null
}

function average(scores: readonly number[]): number {
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/**
 * Trend porównuje średnią NOWSZEJ połowy historii (chronologicznie, wg
 * `createdAt`) do średniej STARSZEJ połowy — nie samą ostatnią próbę do
 * poprzedniej (to już robi plakietka delty na ekranie Kalkulatora, sekcja
 * 4.1) tylko ogólny kierunek na przestrzeni całej historii. Wymaga co
 * najmniej 2 rekordów; różnica zaokrąglona do zera nie liczy się jako trend
 * (unikamy plakietki "+0.0", która nic nie mówi).
 */
export function computeHistoryStats(
  rows: readonly { totalScore: number; createdAt: string }[],
): HistoryStats {
  if (rows.length === 0) return { count: 0, averageScore: null, trend: null }

  const averageScore = average(rows.map((row) => row.totalScore))
  if (rows.length < 2) return { count: rows.length, averageScore, trend: null }

  const sorted = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const mid = Math.floor(sorted.length / 2)
  const olderAvg = average(sorted.slice(0, mid).map((row) => row.totalScore))
  const newerAvg = average(sorted.slice(mid).map((row) => row.totalScore))
  const delta = Number((newerAvg - olderAvg).toFixed(1))

  if (delta === 0) return { count: rows.length, averageScore, trend: null }
  return {
    count: rows.length,
    averageScore,
    trend: { direction: delta > 0 ? "up" : "down", delta },
  }
}
