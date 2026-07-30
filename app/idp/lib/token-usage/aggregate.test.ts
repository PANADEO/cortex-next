// Dane wejściowe mają kształt REALNEJ odpowiedzi /usage: pierwszy blok to
// wprost przypadek z pkg/proxy/usage_handler_test.go (cortex-proxy), pozostałe
// odwzorowują warianty zaobserwowane na żywo w lokalnej bazie proxy
// (source_app="unknown", scope="default", modele reasoningowe).

import { describe, expect, it } from "vitest"
import {
  DEFAULT_SCOPE_LABEL,
  UNKNOWN_APP_LABEL,
  UNKNOWN_USER_LABEL,
  buildUsageReport,
  type ProxyUsageRow,
} from "./aggregate"

function row(overrides: Partial<ProxyUsageRow> = {}): ProxyUsageRow {
  return {
    user_id: "u1",
    source_app: "app",
    scope: "scope",
    model: "gpt-4o",
    request_tokens: 0,
    response_tokens: 0,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    request_count: 0,
    ...overrides,
  }
}

/** Dokładnie wiersze oczekiwane przez TestUsageHandlerReturnsAggregatedUsage. */
const GO_CONTRACT_ROWS: ProxyUsageRow[] = [
  row({
    user_id: "u1",
    source_app: "app",
    scope: "scope",
    model: "gpt-4o",
    request_tokens: 12,
    response_tokens: 8,
    reasoning_tokens: 1,
    cached_tokens: 1,
    total_tokens: 21,
    request_count: 2,
  }),
  row({
    user_id: "u2",
    source_app: "other",
    scope: "scope",
    model: "gpt-4o-mini",
    request_tokens: 4,
    response_tokens: 4,
    total_tokens: 8,
    request_count: 1,
  }),
]

describe("buildUsageReport — sumy globalne", () => {
  it("sumuje wszystkie pięć liczników i liczbę żądań", () => {
    const { totals } = buildUsageReport(GO_CONTRACT_ROWS)

    expect(totals.totalTokens).toBe(29)
    expect(totals.requestTokens).toBe(16)
    expect(totals.responseTokens).toBe(12)
    expect(totals.cachedTokens).toBe(1)
    expect(totals.requestCount).toBe(3)
  })

  // Sedno poprawki wobec oryginału: process_usage_data() w Streamlicie w ogóle
  // nie czyta reasoning_tokens, więc ta liczba przepadała.
  it("agreguje reasoning_tokens, których oryginał gubił", () => {
    const { totals } = buildUsageReport([
      row({ user_id: "a", reasoning_tokens: 1500, total_tokens: 4000 }),
      row({ user_id: "b", reasoning_tokens: 2563, total_tokens: 6000 }),
    ])

    expect(totals.reasoningTokens).toBe(4063)
  })

  // total_tokens jest wartością autorytatywną z proxy, nie sumą składników —
  // gdy dostawca poda własną sumę, proxy zapisuje ją bez zmian. Doklejanie
  // reasoning podwójnie liczyłoby modele, u których siedzi on w completion.
  it("nie rekonstruuje total_tokens z request+response+reasoning", () => {
    const { totals } = buildUsageReport([
      row({ request_tokens: 10, response_tokens: 5, reasoning_tokens: 4, total_tokens: 15 }),
    ])

    expect(totals.totalTokens).toBe(15)
  })

  it("liczy aktywnych użytkowników jako tych z niezerowym zużyciem", () => {
    const { totals } = buildUsageReport([
      row({ user_id: "aktywny", total_tokens: 100, request_count: 1 }),
      row({ user_id: "pusty", total_tokens: 0, request_count: 3 }),
    ])

    expect(totals.userCount).toBe(2)
    expect(totals.activeUsers).toBe(1)
    expect(totals.averageTokensPerActiveUser).toBe(100)
  })
})

describe("buildUsageReport — normalizacja obu wariantów pustych wymiarów", () => {
  // Schemat SQLite ma DEFAULT '' (stare wiersze), a dzisiejszy logMiddleware
  // wpisuje "unknown"/"default". Streamlit normalizuje wyłącznie pierwszy
  // wariant i pokazuje "unknown" jako zwyczajną nazwę aplikacji.
  it("zwija pusty string i słowo-wypełniacz do jednej pozycji", () => {
    const report = buildUsageReport([
      row({ user_id: "a", source_app: "", scope: "", total_tokens: 10, request_count: 1 }),
      row({
        user_id: "b",
        source_app: "unknown",
        scope: "default",
        total_tokens: 30,
        request_count: 2,
      }),
    ])

    expect(report.byApp).toHaveLength(1)
    expect(report.byApp[0]?.key).toBe(UNKNOWN_APP_LABEL)
    expect(report.byApp[0]?.totalTokens).toBe(40)

    expect(report.byScope).toHaveLength(1)
    expect(report.byScope[0]?.key).toBe(DEFAULT_SCOPE_LABEL)
    expect(report.byScope[0]?.totalTokens).toBe(40)
  })

  it("normalizuje pusty i nieznany identyfikator użytkownika", () => {
    const report = buildUsageReport([
      row({ user_id: "", total_tokens: 5 }),
      row({ user_id: "unknown", total_tokens: 7 }),
    ])

    expect(report.byUser).toHaveLength(1)
    expect(report.byUser[0]?.key).toBe(UNKNOWN_USER_LABEL)
    expect(report.byUser[0]?.totalTokens).toBe(12)
  })

  // "anonymous" pochodzi z INNEJ ścieżki w proxy i znaczy "jawnie anonimowy",
  // a nie "brak informacji" — zlanie go z "unknown" zniszczyłoby rozróżnienie.
  it("zostawia anonymous jako odrębną, realną wartość", () => {
    const report = buildUsageReport([
      row({ user_id: "anonymous", total_tokens: 5 }),
      row({ user_id: "unknown", total_tokens: 7 }),
    ])

    expect(report.byUser.map((user) => user.key).sort()).toEqual([
      UNKNOWN_USER_LABEL,
      "anonymous",
    ])
  })

  // Proxy grupuje po SUROWYCH wartościach, więc "" i "unknown" przychodzą jako
  // osobne wiersze. Bez ponownej agregacji tabela szczegółowa pokazywałaby dwa
  // wizualnie nierozróżnialne wiersze o tych samych czterech wymiarach.
  it("re-agreguje wiersze szczegółowe, które po normalizacji się zlewają", () => {
    const report = buildUsageReport([
      row({ user_id: "a", source_app: "", scope: "x", total_tokens: 10, request_count: 1 }),
      row({ user_id: "a", source_app: "unknown", scope: "x", total_tokens: 25, request_count: 4 }),
    ])

    expect(report.rows).toHaveLength(1)
    expect(report.rows[0]).toMatchObject({
      user: "a",
      app: UNKNOWN_APP_LABEL,
      scope: "x",
      totalTokens: 35,
      requestCount: 5,
    })
  })
})

describe("buildUsageReport — udziały i rankingi", () => {
  it("liczy udział procentowy względem sumy tokenów", () => {
    const report = buildUsageReport([
      row({ user_id: "a", total_tokens: 75 }),
      row({ user_id: "b", total_tokens: 25 }),
    ])

    expect(report.byUser[0]).toMatchObject({ key: "a", share: 75 })
    expect(report.byUser[1]).toMatchObject({ key: "b", share: 25 })
  })

  it("sortuje malejąco po tokenach i wskazuje szczyt każdego wymiaru", () => {
    const report = buildUsageReport([
      row({ model: "maly", source_app: "app-a", scope: "s-a", total_tokens: 5 }),
      row({ model: "duzy", source_app: "app-b", scope: "s-b", total_tokens: 500 }),
    ])

    expect(report.byModel.map((group) => group.key)).toEqual(["duzy", "maly"])
    expect(report.totals.topModel).toBe("duzy")
    expect(report.totals.topApp).toBe("app-b")
    expect(report.totals.topScope).toBe("s-b")
    expect(report.totals.modelCount).toBe(2)
  })

  it("przy remisie sortuje alfabetycznie, żeby wynik był powtarzalny", () => {
    const report = buildUsageReport([
      row({ model: "zeta", total_tokens: 10 }),
      row({ model: "alfa", total_tokens: 10 }),
    ])

    expect(report.byModel.map((group) => group.key)).toEqual(["alfa", "zeta"])
  })

  it("zlicza unikalnych użytkowników w wymiarze modelu", () => {
    const report = buildUsageReport([
      row({ user_id: "a", model: "m", total_tokens: 1 }),
      row({ user_id: "b", model: "m", total_tokens: 1 }),
      row({ user_id: "a", model: "m", scope: "inny", total_tokens: 1 }),
    ])

    expect(report.byModel[0]?.userCount).toBe(2)
  })
})

describe("buildUsageReport — przypadki brzegowe", () => {
  // Oryginał wywala się NameError-em, gdy scope_stats jest puste (linia z col5).
  // Pusty zakres dat to realny, codzienny przypadek, nie egzotyka.
  it("pusta odpowiedź daje pusty, kompletny raport zamiast wyjątku", () => {
    const report = buildUsageReport([])

    expect(report.totals.totalTokens).toBe(0)
    expect(report.totals.activeUsers).toBe(0)
    expect(report.totals.averageTokensPerActiveUser).toBe(0)
    expect(report.totals.topScope).toBeNull()
    expect(report.byScope).toEqual([])
    expect(report.rows).toEqual([])
  })

  it("zerowe zużycie nie daje NaN w udziałach", () => {
    const report = buildUsageReport([row({ user_id: "a", total_tokens: 0, request_count: 2 })])

    expect(report.byUser[0]?.share).toBe(0)
    expect(Number.isNaN(report.byUser[0]?.share)).toBe(false)
  })

  it("ignoruje ujemne i niepoliczalne wartości z cudzego serwisu", () => {
    const report = buildUsageReport([
      row({ user_id: "a", total_tokens: 100 }),
      row({ user_id: "b", total_tokens: -50, request_count: Number.NaN }),
    ])

    expect(report.totals.totalTokens).toBe(100)
    expect(report.totals.requestCount).toBe(0)
    expect(report.byUser[0]?.share).toBe(100)
  })
})
