/* @vitest-environment jsdom */
// Renderuje REALNY page.tsx (nie tylko czyste funkcje z highlight.ts) i
// dowodzi, że wynik prawdziwego mikroserwisu faktycznie trafia w DOM jako
// <mark> na dokładnie właściwej pozycji — highlight.test.ts dowodzi
// poprawności SAMEJ matematyki (buildHighlightRanges), ten plik dowodzi, że
// page.tsx tej matematyki w ogóle poprawnie używa przy renderze.
//
// FIRST_RESPONSE to DOSŁOWNIE odpowiedź prawdziwego, uruchomionego
// mikroserwisu (services/geo-score-calculator, obraz zbudowany lokalnie,
// `curl -X POST http://localhost:8010/analyze` z tym samym tekstem) — nie
// wymyślony fixture. Zweryfikowane niezależnie w Pythonie:
// text[21:26] == "5 mln", text[49:58] == "najlepszy".
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnalyzeGeoScoreResponseDto } from "@/features/geo-score-calculator/types"
import GeoScoreCalculatorPage from "./page"

const ANALYZED_TEXT = "Spółka zainwestowała 5 mln w nowy zakład. To był najlepszy rok w historii firmy."

// Odpowiedź prawdziwego mikroserwisu (curl http://localhost:8010/analyze),
// patrz nagłówek pliku.
const FIRST_RESPONSE: AnalyzeGeoScoreResponseDto = {
  totalScore: 62.1,
  grade: "C",
  wordCount: 14,
  statistics: { score: 100, count: 1, per100Words: 7.14, examples: [{ value: "5 mln", position: 21 }] },
  actionVerbs: {
    score: 100,
    actionVerbCount: 1,
    totalVerbCount: 3,
    ratio: 0.333,
    foundVerbs: ["zainwestować"],
    method: "spacy",
  },
  structure: { score: 0, bulletCount: 0, per500Words: 0, hasHeaders: false, paragraphCount: 1 },
  objectivity: {
    score: 28.6,
    subjectiveCount: 1,
    subjectiveRatio: 0.0714,
    foundWords: [{ value: "najlepszy", position: 49 }],
  },
  recommendations: [
    "Dodaj bullet points lub listę numerowaną z kluczowymi informacjami",
    "Rozważ dodanie śródtytułów dla lepszej czytelności",
    "'najlepszy' → 'wysoko oceniany'",
  ],
}

// Druga analiza (po edycji) — wynik lepszy, dowodzi plakietki delty w sesji.
const SECOND_RESPONSE: AnalyzeGeoScoreResponseDto = {
  ...FIRST_RESPONSE,
  totalScore: 74.6,
  grade: "C",
  statistics: { score: 100, count: 1, per100Words: 6.25, examples: [{ value: "5 mln", position: 21 }] },
  objectivity: { score: 100, subjectiveCount: 0, subjectiveRatio: 0, foundWords: [] },
  recommendations: [
    "Dodaj bullet points lub listę numerowaną z kluczowymi informacjami",
    "Rozważ dodanie śródtytułów dla lepszej czytelności",
  ],
}

const mutateAsync = vi.hoisted(() => vi.fn())

vi.mock("@/features/geo-score-calculator/hooks", () => ({
  useAnalyzeGeoScore: () => ({ mutateAsync, isPending: false }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("GeoScoreCalculatorPage", () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  afterEach(() => cleanup())

  it("renderuje edit mode z licznikiem słów i przyciskiem Wczytaj przykład w pustym stanie", async () => {
    render(<GeoScoreCalculatorPage />)

    expect(screen.getByLabelText("Tekst do analizy")).toBeInTheDocument()
    expect(screen.getByText(/0 słów/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Wczytaj przykład" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Analizuj/ })).toBeDisabled()
  })

  it("po analizie podświetla DOKŁADNIE właściwe fragmenty tekstu z realnej odpowiedzi mikroserwisu — nie za mało, nie za dużo", async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValueOnce(FIRST_RESPONSE)
    render(<GeoScoreCalculatorPage />)

    await user.type(screen.getByLabelText("Tekst do analizy"), ANALYZED_TEXT)
    await user.click(screen.getByRole("button", { name: /Analizuj/ }))

    expect(await screen.findByText("62.1")).toBeInTheDocument()
    expect(screen.getByText("Ocena C")).toBeInTheDocument()

    // Dwa <mark> w DOM, każdy z DOKŁADNIE oczekiwanym tekstem — nie
    // podciągiem, nie z doklejonym sąsiednim słowem/spacją.
    const marks = document.querySelectorAll("mark")
    expect(marks).toHaveLength(2)
    expect(marks[0]!.textContent).toBe("5 mln")
    expect(marks[1]!.textContent).toBe("najlepszy")

    // Podświetlone fragmenty leżą w poprawnym miejscu w otaczającym tekście —
    // dowód, że to nie przypadkowe dopasowanie tej samej frazy gdzie indziej.
    const container = marks[0]!.closest("div")!
    expect(container.textContent).toBe(ANALYZED_TEXT)
    expect(container.textContent!.indexOf("5 mln")).toBe(21)
    expect(container.textContent!.indexOf("najlepszy")).toBe(49)

    // 4 paski wymiarów z podpisami liczbowymi. Statystyki i Czasowniki akcji
    // mają w TEJ realnej odpowiedzi ten sam wynik (100.0/100) — stąd
    // getAllByText(length 2), nie getByText (rzuciłby na niejednoznaczności).
    expect(screen.getByText("Statystyki i dane")).toBeInTheDocument()
    expect(screen.getByText("Czasowniki akcji")).toBeInTheDocument()
    expect(screen.getAllByText("100.0/100")).toHaveLength(2)
    expect(screen.getByText("Struktura tekstu")).toBeInTheDocument()
    expect(screen.getByText("0.0/100")).toBeInTheDocument()
    expect(screen.getByText("Obiektywność")).toBeInTheDocument()
    expect(screen.getByText("28.6/100")).toBeInTheDocument()

    // Brak plakietki delty na PIERWSZEJ analizie tej sesji.
    expect(screen.queryByText(/od poprzedniej analizy/)).not.toBeInTheDocument()
  })

  it("rekomendacja z cytowanym słowem jest klikalna i podświetla powiązany fragment", async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValueOnce(FIRST_RESPONSE)
    render(<GeoScoreCalculatorPage />)

    await user.type(screen.getByLabelText("Tekst do analizy"), ANALYZED_TEXT)
    await user.click(screen.getByRole("button", { name: /Analizuj/ }))
    await screen.findByText("62.1")

    const recommendation = screen.getByRole("button", { name: "'najlepszy' → 'wysoko oceniany'" })
    const marks = document.querySelectorAll("mark")
    const subjectiveMark = marks[1]!
    const scrollSpy = vi.fn()
    subjectiveMark.scrollIntoView = scrollSpy

    await user.click(recommendation)

    expect(scrollSpy).toHaveBeenCalled()

    // Pozostałe rekomendacje (bez cytowanego słowa) NIE są klikalne.
    expect(
      screen.getByText("Dodaj bullet points lub listę numerowaną z kluczowymi informacjami"),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Dodaj bullet points lub listę numerowaną z kluczowymi informacjami" }),
    ).not.toBeInTheDocument()
  })

  it("Edytuj ponownie wraca do trybu edycji z zachowanym tekstem", async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValueOnce(FIRST_RESPONSE)
    render(<GeoScoreCalculatorPage />)

    await user.type(screen.getByLabelText("Tekst do analizy"), ANALYZED_TEXT)
    await user.click(screen.getByRole("button", { name: /Analizuj/ }))
    await screen.findByText("62.1")

    await user.click(screen.getByRole("button", { name: "Edytuj ponownie" }))

    expect(screen.getByLabelText("Tekst do analizy")).toHaveValue(ANALYZED_TEXT)
  })

  it("druga analiza w tej samej sesji pokazuje plakietkę delty względem poprzedniej próby", async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValueOnce(FIRST_RESPONSE).mockResolvedValueOnce(SECOND_RESPONSE)
    render(<GeoScoreCalculatorPage />)

    await user.type(screen.getByLabelText("Tekst do analizy"), ANALYZED_TEXT)
    await user.click(screen.getByRole("button", { name: /Analizuj/ }))
    await screen.findByText("62.1")

    await user.click(screen.getByRole("button", { name: "Edytuj ponownie" }))
    await user.type(screen.getByLabelText("Tekst do analizy"), " Dopisany akapit z konkretami.")
    await user.click(screen.getByRole("button", { name: /Analizuj/ }))

    expect(await screen.findByText("74.6")).toBeInTheDocument()
    const delta = screen.getByText(/od poprzedniej analizy/)
    expect(within(delta.closest("div")!).getByText(/\+12\.5/)).toBeInTheDocument()
  })
})
