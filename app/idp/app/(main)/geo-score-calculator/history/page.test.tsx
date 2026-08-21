/* @vitest-environment jsdom */
// Renderuje REALNY page.tsx z danymi ZDJĘTYMI wprost z izolowanej
// cortex-next-postgres (SELECT na geo_score_calculator.calculations,
// weryfikacja Fazy 2, `docker exec cortex-next-postgres psql ...`) — nie
// wymyślonym fixture'em, wzorem geo-score-calculator/page.test.tsx (Faza 1,
// "FIRST_RESPONSE to DOSŁOWNIE odpowiedź prawdziwego, uruchomionego
// mikroserwisu"). Trzy rekordy zapisane przez POST /analyze podczas
// wcześniejszej realnej weryfikacji: dwa o ocenie C (ten sam tekst
// przeanalizowany dwukrotnie), jeden o ocenie F — celowo dobra mieszanka
// pod testy wyszukiwania i filtra oceny.
import type { GeoScoreCalculationSummaryDto } from "@/features/geo-score-calculator/types"
import { formatAbsolute } from "@cortex/utils"
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import GeoScoreCalculatorHistoryPage from "./page"

const REAL_HISTORY: GeoScoreCalculationSummaryDto[] = [
  {
    id: "f6993874-3ec0-4b12-94f4-bab81ee1b6c9",
    textPreview: "Spółka zainwestowała 5 mln w nowy zakład. To był najlepszy rok w historii firmy.",
    wordCount: 14,
    totalScore: 62.1,
    grade: "C",
    createdAt: "2026-08-03T11:14:13.123Z",
  },
  {
    id: "c6755897-5012-4910-a5b1-3c771d645d70",
    textPreview: "Test bez uprawnień.",
    wordCount: 3,
    totalScore: 25,
    grade: "F",
    createdAt: "2026-08-03T10:57:25.973Z",
  },
  {
    id: "9cbca6c2-1fc2-4978-8fb8-7b144093029f",
    textPreview: "Spółka zainwestowała 5 mln w nowy zakład. To był najlepszy rok w historii firmy.",
    wordCount: 14,
    totalScore: 62.1,
    grade: "C",
    createdAt: "2026-08-03T10:57:11.108Z",
  },
]

const routerPush = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }))

const downloadHistoryExport = vi.hoisted(() => vi.fn())
vi.mock("@/features/geo-score-calculator/export", () => ({ downloadHistoryExport }))

const useMyGeoScoreHistory = vi.hoisted(() => vi.fn())
vi.mock("@/features/geo-score-calculator/hooks", () => ({ useMyGeoScoreHistory }))

describe("GeoScoreCalculatorHistoryPage", () => {
  // jsdom nie implementuje Pointer Capture API ani scrollIntoView, których
  // realny (nie zamockowany) Radix `Select` używa przy interakcji — wzorem
  // components/intrastat/upload-batch-button.test.tsx.
  beforeAll(() => {
    Object.defineProperties(Element.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => undefined },
      setPointerCapture: { configurable: true, value: () => undefined },
      scrollIntoView: { configurable: true, value: () => undefined },
    })
  })

  beforeEach(() => {
    routerPush.mockReset()
    downloadHistoryExport.mockReset()
    useMyGeoScoreHistory.mockReturnValue({ data: REAL_HISTORY, isLoading: false })
  })

  afterEach(() => cleanup())

  it("renderuje KPI (liczba/średnia/trend) policzone z REALNYCH danych", () => {
    render(<GeoScoreCalculatorHistoryPage />)

    // Scoping do kontenera karty KPI — "3" i "49.7" mogłyby kolidować z
    // innymi liczbami na stronie (np. wordCount wiersza), więc szukamy w
    // obrębie konkretnej karty, nie globalnie.
    const countCard = screen.getByText("Liczba analiz").closest("div")!
    expect(within(countCard).getByText("3")).toBeInTheDocument()

    const averageCard = screen.getByText("Średni wynik").closest("div")!
    // (62.1 + 25 + 62.1) / 3 = 49.73... -> "49.7"
    expect(within(averageCard).getByText("49.7")).toBeInTheDocument()
  })

  it("renderuje wszystkie 3 wiersze z realnej historii, najnowszy pierwszy", () => {
    render(<GeoScoreCalculatorHistoryPage />)

    const rows = screen.getAllByRole("row").slice(1) // bez wiersza nagłówka
    expect(rows).toHaveLength(3)
    // REAL_HISTORY jest już posortowana najnowsze-pierwsze (kolejność
    // zwracana przez realny listMyCalculations()) — daty formatowane przez
    // `formatAbsolute` samej strony, nie sztywny string, żeby test nie
    // zależał od strefy czasowej maszyny uruchamiającej testy.
    expect(
      within(rows[0]!).getByText(formatAbsolute(REAL_HISTORY[0]!.createdAt)),
    ).toBeInTheDocument()
    expect(within(rows[1]!).getByText("F")).toBeInTheDocument()
    expect(
      within(rows[1]!).getByText(formatAbsolute(REAL_HISTORY[1]!.createdAt)),
    ).toBeInTheDocument()
    expect(
      within(rows[2]!).getByText(formatAbsolute(REAL_HISTORY[2]!.createdAt)),
    ).toBeInTheDocument()
  })

  it("wyszukiwanie filtruje po TREŚCI PODGLĄDU — 'uprawnień' zostawia dokładnie 1 z 3 wierszy", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorHistoryPage />)

    await user.type(screen.getByPlaceholderText("Szukaj w tekście…"), "uprawnień")

    const rows = screen.getAllByRole("row").slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]!).getByText("Test bez uprawnień.")).toBeInTheDocument()
  })

  it("filtr oceny F zostawia dokładnie 1 z 3 wierszy (te dwie inne są C)", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorHistoryPage />)

    await user.click(screen.getByRole("combobox", { name: "Ocena" }))
    await user.click(screen.getByRole("option", { name: "Ocena F" }))

    const rows = screen.getAllByRole("row").slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]!).getByText("25.0")).toBeInTheDocument()
  })

  it("klik w ChevronRight nawiguje do /geo-score-calculator/history/:id właściwego wiersza", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorHistoryPage />)

    const rows = screen.getAllByRole("row").slice(1)
    await user.click(within(rows[1]!).getByRole("button"))

    expect(routerPush).toHaveBeenCalledWith(
      "/geo-score-calculator/history/c6755897-5012-4910-a5b1-3c771d645d70",
    )
  })

  it("eksport CSV/JSON woła downloadHistoryExport z PEŁNĄ (niefiltrowaną) historią", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorHistoryPage />)

    await user.click(screen.getByRole("button", { name: /Eksportuj/ }))
    await user.click(screen.getByRole("menuitem", { name: "Eksportuj CSV" }))

    expect(downloadHistoryExport).toHaveBeenCalledWith(REAL_HISTORY, "csv")
  })

  it("pusta historia pokazuje empty state, nie pustą tabelę", () => {
    useMyGeoScoreHistory.mockReturnValue({ data: [], isLoading: false })
    render(<GeoScoreCalculatorHistoryPage />)

    expect(screen.getByText("Brak analiz")).toBeInTheDocument()
  })
})
