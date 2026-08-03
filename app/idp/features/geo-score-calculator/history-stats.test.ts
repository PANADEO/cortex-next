import { describe, expect, it } from "vitest"
import { computeHistoryStats } from "./history-stats"

describe("computeHistoryStats", () => {
  it("pusta historia: count 0, averageScore null, brak trendu", () => {
    expect(computeHistoryStats([])).toEqual({ count: 0, averageScore: null, trend: null })
  })

  it("jeden rekord: liczy średnią, ale nie ma trendu (za mało danych)", () => {
    const stats = computeHistoryStats([{ totalScore: 80, createdAt: "2026-08-01T10:00:00Z" }])
    expect(stats).toEqual({ count: 1, averageScore: 80, trend: null })
  })

  it("średnia liczona ze wszystkich rekordów", () => {
    const stats = computeHistoryStats([
      { totalScore: 40, createdAt: "2026-08-01T10:00:00Z" },
      { totalScore: 60, createdAt: "2026-08-02T10:00:00Z" },
      { totalScore: 80, createdAt: "2026-08-03T10:00:00Z" },
    ])
    expect(stats.count).toBe(3)
    expect(stats.averageScore).toBeCloseTo(60)
  })

  it("trend rosnący: nowsza połowa historii ma wyższą średnią", () => {
    const stats = computeHistoryStats([
      { totalScore: 40, createdAt: "2026-08-01T10:00:00Z" },
      { totalScore: 90, createdAt: "2026-08-02T10:00:00Z" },
    ])
    expect(stats.trend).toEqual({ direction: "up", delta: 50 })
  })

  it("trend malejący: nowsza połowa historii ma niższą średnią", () => {
    const stats = computeHistoryStats([
      { totalScore: 90, createdAt: "2026-08-01T10:00:00Z" },
      { totalScore: 40, createdAt: "2026-08-02T10:00:00Z" },
    ])
    expect(stats.trend).toEqual({ direction: "down", delta: -50 })
  })

  it("trend liczony chronologicznie wg createdAt, NIE wg kolejności w tablicy wejściowej", () => {
    // Wejście celowo w odwrotnej kolejności (najnowszy pierwszy, jak zwraca
    // listMyCalculations()) — funkcja musi sama posortować rosnąco.
    const stats = computeHistoryStats([
      { totalScore: 90, createdAt: "2026-08-02T10:00:00Z" },
      { totalScore: 40, createdAt: "2026-08-01T10:00:00Z" },
    ])
    expect(stats.trend).toEqual({ direction: "up", delta: 50 })
  })

  it("delta zaokrąglona do zera nie liczy się jako trend", () => {
    const stats = computeHistoryStats([
      { totalScore: 50, createdAt: "2026-08-01T10:00:00Z" },
      { totalScore: 50.02, createdAt: "2026-08-02T10:00:00Z" },
    ])
    expect(stats.trend).toBeNull()
  })

  it("nieparzysta liczba rekordów: środkowy element trafia do nowszej połowy", () => {
    const stats = computeHistoryStats([
      { totalScore: 100, createdAt: "2026-08-01T10:00:00Z" },
      { totalScore: 0, createdAt: "2026-08-02T10:00:00Z" },
      { totalScore: 0, createdAt: "2026-08-03T10:00:00Z" },
    ])
    // starsza=[100], nowsza=[0,0] -> średnia nowsza 0, starsza 100, delta -100
    expect(stats.trend).toEqual({ direction: "down", delta: -100 })
  })
})
