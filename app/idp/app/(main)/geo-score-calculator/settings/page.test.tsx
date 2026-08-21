/* @vitest-environment jsdom */
// Renderuje REALNY page.tsx + GeoScoreSettingsForm — dowodzi, że design doc
// §4.4 jest faktycznie zaimplementowany, nie tylko że pojedyncze funkcje
// czyste (config-schema.test.ts) się zgadzają:
// - żywy pasek sumy wag aktualizuje się na KAŻDĄ zmianę suwaka, nie dopiero
//   przy Zapisz, i blokuje przycisk Zapisz gdy suma ≠ 100%;
// - ChipInput faktycznie dodaje nowe słowo do payloadu PUT;
// - reset jest gated przez AlertDialog (bez potwierdzenia NIC się nie woła).

import type { GeoScoreConfigDto } from "@/features/geo-score-calculator/types"
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import GeoScoreCalculatorSettingsPage from "./page"

// jsdom nie implementuje ResizeObserver — potrzebny przez Radix ScrollArea
// (użyty wewnątrz ChipInput, pierwszego konsumenta tego prymitywu w testach
// jsdom w tym module). Polyfill lokalny dla tego pliku, nie globalny setup —
// żeby nie dotykać współdzielonego vitest.config.ts.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

const CONFIG: GeoScoreConfigDto = {
  weightStatistics: 0.3,
  weightActionVerbs: 0.25,
  weightStructure: 0.2,
  weightObjectivity: 0.25,
  benchmarkStats: 4,
  benchmarkVerbs: 0.15,
  benchmarkStructure: 3,
  benchmarkObjectivity: 0.05,
  gradeAMin: 90,
  gradeBMin: 75,
  gradeCMin: 60,
  gradeDMin: 40,
  actionVerbs: ["wdrożył", "uruchomił"],
  subjectiveWords: ["najlepszy"],
  falsePositives: [],
  bulletPatterns: ["^[\\s]*-\\s+"],
  updatedAt: "2026-08-01T10:00:00Z",
  updatedBy: "admin@firma.pl",
}

const updateMutateAsync = vi.hoisted(() => vi.fn())
const resetMutateAsync = vi.hoisted(() => vi.fn())

vi.mock("@/features/geo-score-calculator/hooks", () => ({
  useGeoScoreConfig: () => ({ data: CONFIG, isLoading: false, isError: false }),
  useUpdateGeoScoreConfig: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useResetGeoScoreConfig: () => ({ mutateAsync: resetMutateAsync, isPending: false }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("GeoScoreCalculatorSettingsPage", () => {
  beforeEach(() => {
    updateMutateAsync.mockReset()
    updateMutateAsync.mockResolvedValue(CONFIG)
    resetMutateAsync.mockReset()
    resetMutateAsync.mockResolvedValue(CONFIG)
  })

  afterEach(() => cleanup())

  it("renderuje wagi jako procenty i pokazuje sumę 100% w tonie sukcesu, Zapisz włączony", () => {
    render(<GeoScoreCalculatorSettingsPage />)

    expect(screen.getByText("Suma: 100%")).toHaveClass("text-success")
    expect(screen.getByRole("button", { name: /Zapisz/ })).toBeEnabled()
  })

  it("zmiana suwaka aktualizuje sumę NA ŻYWO i blokuje Zapisz, gdy suma ≠ 100%", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorSettingsPage />)

    const sliders = screen.getAllByRole("slider")
    sliders[0]!.focus()
    await user.keyboard("{ArrowRight}")

    expect(await screen.findByText("Suma: 101%")).toHaveClass("text-destructive")
    expect(screen.getByRole("button", { name: /Zapisz/ })).toBeDisabled()
  })

  it("dodanie czasownika przez ChipInput trafia do payloadu PUT po zapisaniu", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorSettingsPage />)

    const actionVerbsInput = screen.getByPlaceholderText("np. wdrożył — Enter, aby dodać")
    await user.type(actionVerbsInput, "przetestował{Enter}")

    expect(screen.getByText("przetestował")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Zapisz/ }))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1))
    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        actionVerbs: ["wdrożył", "uruchomił", "przetestował"],
        weightStatistics: 0.3,
      }),
    )
  })

  it("Przywróć domyślne NIE woła resetu bez potwierdzenia w AlertDialog", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorSettingsPage />)

    await user.click(screen.getByRole("button", { name: /Przywróć domyślne/ }))

    expect(screen.getByText("Przywrócić domyślną konfigurację?")).toBeInTheDocument()
    expect(resetMutateAsync).not.toHaveBeenCalled()
  })

  it("potwierdzenie w AlertDialog woła reset", async () => {
    const user = userEvent.setup()
    render(<GeoScoreCalculatorSettingsPage />)

    await user.click(screen.getByRole("button", { name: /Przywróć domyślne/ }))
    const dialog = screen.getByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Przywróć domyślne" }))

    await waitFor(() => expect(resetMutateAsync).toHaveBeenCalledTimes(1))
  })
})
