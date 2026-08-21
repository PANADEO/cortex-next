// @vitest-environment jsdom
//
// Strażnik podziału KLUCZ / NAPIS w formularzach AI Tools.
//
// Listy wyboru trzymają w stanie klucz tłumaczenia, a nie widoczny napis —
// bo wartość opcji jedzie wprost do promptu (`lib/ai-tools/prompts.ts`), a
// prompt jest instrukcją dla modelu, nie tekstem interfejsu. Gdyby ktoś to
// „uprościł" i wstawił do stanu przetłumaczony napis, przełączenie języka
// zostawiłoby w `value` napis, którego nie ma już wśród opcji, i lista
// pokazałaby się PUSTA. Awaria byłaby cicha: ekran renderuje się dalej.
//
// Dlatego test renderuje ten sam formularz w obu językach i sprawdza, że
// zaznaczenie domyślne widać po obu stronach. Asercje na polskich napisach są
// celowe — polski jest językiem źródłowym.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/api", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@cortex/api")
  return { ...actual, useAuthorizedApps: () => ({ apps: ["ai-tools"], isLoading: false }) }
})

import i18n from "@/lib/i18n"
import { AiToolWorkspace } from "./ai-tool-workspace"

function renderTool(toolId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiToolWorkspace toolId={toolId} />
    </QueryClientProvider>,
  )
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage("pl")
})

describe("AI Tools — napisy formularza", () => {
  it("po polsku bierze nazwę narzędzia z rejestru, a etykiety z przestrzeni `ai-tools`", async () => {
    await i18n.changeLanguage("pl")
    renderTool("ai-summarizer")

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sumaryzator")
    expect(screen.getByLabelText("Tekst", { exact: true })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Generuj" })).toBeTruthy()
    expect(screen.getByText("Wynik pojawi się tutaj po wygenerowaniu.")).toBeTruthy()
    // Zaznaczenie domyślne listy wyboru — klucz `short`, napis z bundla.
    expect(screen.getByText("Krótko, 120-200 słów")).toBeTruthy()
  })

  it("po angielsku tłumaczy nazwę narzędzia przez `tiles` i nie gubi zaznaczenia list", async () => {
    await i18n.changeLanguage("en")
    renderTool("ai-summarizer")

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Summarizer")
    expect(screen.getByRole("button", { name: "Generate" })).toBeTruthy()
    expect(screen.getByText("Short, 120-200 words")).toBeTruthy()
  })

  it("fakturomat: etykieta pola pliku i zaznaczenie domyślne typu analizy", async () => {
    await i18n.changeLanguage("pl")
    renderTool("fakturomat")

    expect(screen.getByLabelText("Plik faktury", { exact: true })).toBeTruthy()
    expect(screen.getByText("Pełna analiza faktury")).toBeTruthy()
  })
})
