/* @vitest-environment jsdom */
// Renderuje REALNY page.tsx z rekordem ZDJĘTYM wprost z izolowanej
// cortex-next-postgres (SELECT na geo_score_calculator.calculations,
// weryfikacja Fazy 2, `docker exec cortex-next-postgres psql ...`) — nie
// wymyślonym fixture'em, wzorem geo-score-calculator/page.test.tsx (Faza 1).
// `REAL_RESULT`/`REAL_CONFIG_SNAPSHOT` to DOSŁOWNIE `result`/`config_snapshot`
// zapisane przez POST /analyze (Faza 1) dla wiersza
// f6993874-3ec0-4b12-94f4-bab81ee1b6c9 — dowodzi, że strona szczegółów
// faktycznie renderuje pełną, prawdziwą migawkę configu (design doc §4.3:
// "czego dzisiejszy UI nie eksponuje mimo że dane już są zapisywane"), nie
// tylko strukturę zgodną z typem.
import type { AnalyzeGeoScoreResponseDto } from "@/features/geo-score-calculator/types"
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import GeoScoreCalculatorHistoryDetailPage from "./page"

const REAL_ID = "f6993874-3ec0-4b12-94f4-bab81ee1b6c9"
const REAL_TEXT_CONTENT =
  "Spółka zainwestowała 5 mln w nowy zakład. To był najlepszy rok w historii firmy."

const REAL_RESULT: AnalyzeGeoScoreResponseDto = JSON.parse(
  `{"grade": "C", "structure": {"score": 0, "hasHeaders": false, "bulletCount": 0, "per500Words": 0, "paragraphCount": 1}, "wordCount": 14, "statistics": {"count": 1, "score": 100, "examples": [{"value": "5 mln", "position": 21}], "per100Words": 7.14}, "totalScore": 62.1, "actionVerbs": {"ratio": 0.333, "score": 100, "method": "spacy", "foundVerbs": ["zainwestować"], "totalVerbCount": 3, "actionVerbCount": 1}, "objectivity": {"score": 28.6, "foundWords": [{"value": "najlepszy", "position": 49}], "subjectiveCount": 1, "subjectiveRatio": 0.0714}, "recommendations": ["Dodaj bullet points lub listę numerowaną z kluczowymi informacjami", "Rozważ dodanie śródtytułów dla lepszej czytelności", "'najlepszy' → 'wysoko oceniany'"]}`,
)

const REAL_CONFIG_SNAPSHOT = JSON.parse(
  `{"id": true, "gradeAMin": 90, "gradeBMin": 75, "gradeCMin": 60, "gradeDMin": 40, "updatedAt": "2026-08-03T07:48:27.590Z", "updatedBy": "system", "actionVerbs": ["wdrożył", "uruchomił", "zwiększył", "zmniejszył", "osiągnął", "zrealizował", "wprowadził", "zakończył", "rozpoczął", "podpisał", "ogłosił", "przedstawił", "zaprezentował", "zainwestował", "sfinansował", "opracował", "stworzył", "zbudował", "rozwinął", "ulepszył", "zmodernizował", "zoptymalizował", "przekształcił", "zautomatyzował", "nawiązał", "połączył", "zintegrował", "skonsolidował", "przejął", "wzrósł", "spadł", "przekroczył", "podwoił", "potroił", "zaoszczędził", "wygenerował", "wypracował", "wdraża", "uruchamia", "zwiększa", "realizuje", "wprowadza", "rozwija", "buduje", "inwestuje", "generuje", "osiąga"], "benchmarkStats": 4, "benchmarkVerbs": 0.15, "bulletPatterns": ["^[\\\\s]*[-•●○◦▪▸►]\\\\s+", "^[\\\\s]*\\\\d+[.\\\\)]\\\\s+", "^[\\\\s]*[a-z][.\\\\)]\\\\s+"], "falsePositives": ["rozwiązania", "rozwiązanie", "rozwiązań", "przedmioty", "przedmiot", "przedmiotów", "osiągnięcia", "osiągnięcie", "osiągnięć", "inwestycja", "inwestycji", "inwestycje", "uruchomienie", "uruchomienia", "wdrożenie", "wdrożenia", "wdrożeń", "zwiększenie", "zwiększenia", "zmniejszenie", "zmniejszenia", "wprowadzenie", "wprowadzenia", "zakończenie", "rozpoczęcie", "przedstawienie", "ogłoszenie", "połączenie", "przekształcenie", "ulepszenie", "usprawnienie"], "subjectiveWords": ["najlepszy", "najlepsza", "najlepsze", "największy", "największa", "najważniejszy", "najważniejsza", "najpopularniejszy", "najnowocześniejszy", "wyjątkowy", "wyjątkowa", "wyjątkowe", "niesamowity", "niesamowita", "doskonały", "doskonała", "perfekcyjny", "idealny", "idealna", "rewolucyjny", "rewolucyjna", "przełomowy", "przełomowa", "innowacyjny", "innowacyjna", "nowoczesny", "nowoczesna", "niezwykły", "niezwykła", "fantastyczny", "fantastyczna", "cudowny", "cudowna", "wspaniały", "wspaniała", "absolutnie", "całkowicie", "niezwykle", "niesamowicie", "wyjątkowo", "nadzwyczaj", "szczególnie", "bardzo", "lider", "liderka", "czołowy", "czołowa", "wiodący", "wiodąca", "premium", "ekskluzywny", "ekskluzywna", "prestiżowy", "prestiżowa", "unikalny", "unikalna", "jedyny", "jedyna"], "weightStructure": 0.2, "weightStatistics": 0.3, "weightActionVerbs": 0.25, "weightObjectivity": 0.25, "benchmarkStructure": 3, "benchmarkObjectivity": 0.05}`,
)

const REAL_CALCULATION = {
  id: REAL_ID,
  textContent: REAL_TEXT_CONTENT,
  textPreview: REAL_TEXT_CONTENT,
  wordCount: 14,
  totalScore: 62.1,
  grade: "C" as const,
  statsScore: 100,
  verbsScore: 100,
  structureScore: 0,
  objectivityScore: 28.6,
  result: REAL_RESULT,
  configSnapshot: REAL_CONFIG_SNAPSHOT,
  createdAt: "2026-08-03T11:14:13.123Z",
}

const routerPush = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: REAL_ID }),
  useRouter: () => ({ push: routerPush }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const useGeoScoreCalculation = vi.hoisted(() => vi.fn())
const deleteMutateAsync = vi.hoisted(() => vi.fn())
vi.mock("@/features/geo-score-calculator/hooks", () => ({
  useGeoScoreCalculation,
  useDeleteGeoScoreCalculation: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}))

describe("GeoScoreCalculatorHistoryDetailPage", () => {
  // jsdom nie implementuje Pointer Capture API, którego realny (nie
  // zamockowany) Radix `AlertDialog` używa przy interakcji — wzorem
  // components/intrastat/upload-batch-button.test.tsx.
  beforeAll(() => {
    Object.defineProperties(Element.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => undefined },
      setPointerCapture: { configurable: true, value: () => undefined },
    })
  })

  beforeEach(() => {
    routerPush.mockReset()
    deleteMutateAsync.mockReset()
    useGeoScoreCalculation.mockReturnValue({
      data: REAL_CALCULATION,
      isLoading: false,
      isError: false,
    })
  })

  afterEach(() => cleanup())

  it("renderuje hero score/ocena i podświetlone fragmenty — TEN SAM widok co Kalkulator", () => {
    render(<GeoScoreCalculatorHistoryDetailPage />)

    expect(screen.getByText("62.1")).toBeInTheDocument()
    expect(screen.getByText("Ocena C")).toBeInTheDocument()
    const marks = document.querySelectorAll("mark")
    expect(marks).toHaveLength(2)
    expect(marks[0]!.textContent).toBe("5 mln")
    expect(marks[1]!.textContent).toBe("najlepszy")
  })

  it("eksponuje PRAWDZIWY configSnapshot użyty do tego wyniku — nie tylko strukturę zgodną z typem", () => {
    render(<GeoScoreCalculatorHistoryDetailPage />)

    expect(screen.getByText("Konfiguracja użyta do tego wyniku")).toBeInTheDocument()
    // Klucze + wartości SKALARNE configSnapshot renderują się zawsze
    // (JsonViewer nie zwija prymitywów, tylko zagnieżdżone obiekty/tablice) —
    // sprawdzamy DOKŁADNIE te wartości, które zapisał realny POST /analyze,
    // nie jakiekolwiek liczby.
    expect(screen.getByText("gradeAMin:")).toBeInTheDocument()
    expect(screen.getByText("gradeDMin:")).toBeInTheDocument()
    expect(screen.getByText("updatedBy:")).toBeInTheDocument()
    // JsonViewer otacza wartości string cudzysłowem w renderze (Node():
    // `&quot;{value}&quot;`) — treść węzła to dosłownie `"system"`, nie `system`.
    expect(screen.getByText('"system"')).toBeInTheDocument()
    expect(screen.getByText("weightStatistics:")).toBeInTheDocument()
  })

  it("stan wczytywania: pokazuje LoadingState, nie pustą stronę", () => {
    useGeoScoreCalculation.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<GeoScoreCalculatorHistoryDetailPage />)

    expect(screen.getByText("Wczytywanie analizy…")).toBeInTheDocument()
    expect(screen.queryByText("62.1")).not.toBeInTheDocument()
  })

  it("404 (cudza/nieistniejąca analiza): pokazuje empty state, nigdy dane cudzego rekordu", () => {
    useGeoScoreCalculation.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<GeoScoreCalculatorHistoryDetailPage />)

    expect(screen.getByText("Nie znaleziono analizy")).toBeInTheDocument()
  })

  it("usuwanie: wymaga potwierdzenia, potem woła mutację z id, toast i powrót do Historii", async () => {
    const user = userEvent.setup()
    deleteMutateAsync.mockResolvedValueOnce({ ok: true })
    render(<GeoScoreCalculatorHistoryDetailPage />)

    await user.click(screen.getByRole("button", { name: "Usuń" }))

    // Radix ukrywa resztę strony (aria-hidden) dopóki modal jest otwarty —
    // jedyny dostępny w a11y-drzewie przycisk "Usuń" po otwarciu dialogu to
    // TEN w środku niego, stąd scoping przez `within`, nie indeks z tablicy.
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Usunąć tę analizę?")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Usuń" }))

    expect(deleteMutateAsync).toHaveBeenCalledWith(REAL_ID)
    expect(routerPush).toHaveBeenCalledWith("/geo-score-calculator/history")
  })
})
