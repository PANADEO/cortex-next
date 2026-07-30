import { describe, expect, it } from "vitest"
import {
  ALL_OPTION,
  availableModels,
  availableScopes,
  filterRows,
  reconcileFilters,
} from "./cascade"
import type { UsageDetailRow } from "./types"

function row(model: string, scope: string): UsageDetailRow {
  return {
    user: "u",
    app: "app",
    scope,
    model,
    requestTokens: 1,
    responseTokens: 1,
    reasoningTokens: 0,
    cachedTokens: 0,
    totalTokens: 2,
    requestCount: 1,
  }
}

const ROWS = [
  row("gpt-4o", "summarizer"),
  row("gpt-4o-mini", "summarizer"),
  row("claude-sonnet", "linkedin-generator"),
]

describe("kaskadowe zawężanie list", () => {
  it("bez filtrów pokazuje komplet obu wymiarów", () => {
    expect(availableModels(ROWS, ALL_OPTION)).toEqual(["claude-sonnet", "gpt-4o", "gpt-4o-mini"])
    expect(availableScopes(ROWS, ALL_OPTION)).toEqual(["linkedin-generator", "summarizer"])
  })

  it("wybrany zakres zawęża listę modeli", () => {
    expect(availableModels(ROWS, "summarizer")).toEqual(["gpt-4o", "gpt-4o-mini"])
  })

  it("wybrany model zawęża listę zakresów", () => {
    expect(availableScopes(ROWS, "claude-sonnet")).toEqual(["linkedin-generator"])
  })

  // Lista modeli zależy od ZAKRESU, nie od samej siebie — inaczej po pierwszym
  // wyborze zwinęłaby się do jednej pozycji i nie dałoby się zmienić zdania.
  it("lista modeli nie zwija się do własnego wyboru", () => {
    expect(availableModels(ROWS, ALL_OPTION)).toHaveLength(3)
  })
})

describe("filtrowanie wierszy", () => {
  it("brak filtrów przepuszcza wszystko", () => {
    expect(filterRows(ROWS, { model: ALL_OPTION, scope: ALL_OPTION })).toHaveLength(3)
  })

  it("filtruje po obu wymiarach naraz", () => {
    const filtered = filterRows(ROWS, { model: "gpt-4o", scope: "summarizer" })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.model).toBe("gpt-4o")
  })
})

describe("reconcileFilters", () => {
  // Bez tego użytkownik zostaje z parą (model, zakres), która nie występuje
  // razem w danych, i widzi pustą tabelę bez wyjaśnienia.
  it("zwalnia model osierocony przez świeżo wybrany zakres", () => {
    const result = reconcileFilters(ROWS, { model: "claude-sonnet", scope: "summarizer" }, "scope")

    expect(result).toEqual({ model: ALL_OPTION, scope: "summarizer" })
  })

  // Lustrzany przypadek: to samo, ale zmienił się model. Wymiar właśnie
  // kliknięty ZOSTAJE — inaczej wybór znikałby natychmiast po kliknięciu.
  it("zwalnia zakres osierocony przez świeżo wybrany model", () => {
    const result = reconcileFilters(ROWS, { model: "claude-sonnet", scope: "summarizer" }, "model")

    expect(result).toEqual({ model: "claude-sonnet", scope: ALL_OPTION })
  })

  it("zostawia parę, która występuje w danych", () => {
    const result = reconcileFilters(ROWS, { model: "gpt-4o", scope: "summarizer" }, "model")

    expect(result).toEqual({ model: "gpt-4o", scope: "summarizer" })
  })

  it("nie rusza wyborów neutralnych", () => {
    const result = reconcileFilters(ROWS, { model: ALL_OPTION, scope: ALL_OPTION }, "model")

    expect(result).toEqual({ model: ALL_OPTION, scope: ALL_OPTION })
  })

  // Wartość, która zniknęła z danych (np. po zmianie zakresu dat), jest
  // nieważna niezależnie od drugiego wymiaru.
  it("zwalnia wybór, którego w danych już w ogóle nie ma", () => {
    const result = reconcileFilters(ROWS, { model: "model-ktorego-nie-ma", scope: ALL_OPTION }, "model")

    expect(result).toEqual({ model: ALL_OPTION, scope: ALL_OPTION })
  })

  it("pusty zbiór danych nie wywala się i zwalnia oba wymiary", () => {
    const result = reconcileFilters([], { model: "gpt-4o", scope: "summarizer" }, "model")

    expect(result).toEqual({ model: ALL_OPTION, scope: ALL_OPTION })
  })
})
