// Podstawowy przepływ każdego narzędzia tekstowego AI Tools:
//   (a) strona przechodzi przez bramkę dostępu i się renderuje,
//   (b) wpisany input trafia do /api/ai-tools/generate z poprawnym toolId i promptem,
//   (c) wynik renderuje się na stronie.
//
// JEDEN plik zamiast sześciu `<narzedzie>.spec.ts`: wszystkie narzędzia
// renderuje ten sam komponent (AiToolWorkspace) i różnią się WYŁĄCZNIE
// konfiguracją pola wejściowego. Tabela poniżej JEST tą różnicą — sześć plików
// po ~10 linii byłoby tą samą tabelą rozsypaną po katalogu. Playwright i tak
// raportuje każde narzędzie jako osobny test.
// Fakturomat (model wizyjny, upload pliku) to realnie inny UI → osobny plik.
//
// Wartości `label` są tu WPISANE NA SZTYWNO, celowo nie importowane z
// app/idp/lib/ai-tools/registry.ts. Test ma trzymać kontrakt, a nie podążać za
// zmianą w rejestrze.
//
// `scope`/`model`/`maxTokens` NIE są już częścią żądania — wyprowadza je serwer
// z `toolId`. Atrybucja zużycia tokenów (X-Scope/X-App) jest dowodzona tam,
// gdzie realnie powstaje, czyli na nagłówkach wychodzących do cortex-proxy:
// app/idp/app/api/ai-tools/generate-hardening.test.ts. Tutaj zostaje asercja
// odwrotna: klient tych pól wysyłać NIE MOŻE.

import { expect, test } from "@playwright/test"
import { AiToolWorkspacePage } from "../poms/ai-tools/tool-workspace-page"
import { expectNoConsoleErrors, installConsoleErrorTracker } from "../support/console"
import {
  mockAiToolsGenerate,
  mockAiToolsHistory,
  SERVER_DERIVED_FIELDS,
} from "../support/mocks/ai-tools-proxy"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

/** Grant na cały kafelek — wystarcza dla każdego narzędzia
 *  (canAccessAiTool: apps.includes("ai-tools") || apps.includes(toolId)). */
const TILE_GRANT = { apps: ["ai-tools"], email: EMAIL }

interface TextToolCase {
  toolId: string
  /** Tytuł strony (<h1>) — AiToolDefinition.label. */
  label: string
  /** Widoczna etykieta pola, które odblokowuje przycisk "Generuj". */
  inputLabel: string
  inputValue: string
}

const TEXT_TOOLS: readonly TextToolCase[] = [
  {
    toolId: "ai-summarizer",
    label: "Sumaryzator",
    inputLabel: "Tekst",
    inputValue: "Protokół ze spotkania zarządu w sprawie budżetu na kolejny kwartał.",
  },
  {
    toolId: "text-transformer",
    label: "Transformator tekstu",
    inputLabel: "Tekst źródłowy",
    inputValue: "Niniejszym uprzejmie informujemy o konieczności dokonania korekty faktury.",
  },
  {
    toolId: "text-analyzer",
    label: "Analizator tekstu",
    inputLabel: "Tekst do analizy",
    inputValue: "Oferta wdrożenia systemu obiegu dokumentów dla działu księgowości.",
  },
  {
    toolId: "text-highlighter",
    label: "Podświetlacz tekstu",
    inputLabel: "Tekst do analizy",
    inputValue: "Umowa wchodzi w życie 1 marca, termin płatności wynosi 30 dni.",
  },
  {
    toolId: "linkedin-generator",
    label: "Generator LinkedIn",
    inputLabel: "Temat",
    inputValue: "Automatyzacja obiegu faktur w firmie logistycznej",
  },
  {
    toolId: "content-guru",
    label: "Kreator treści",
    inputLabel: "Temat",
    inputValue: "Jak skrócić czas obsługi dokumentów celnych",
  },
]

test.describe("AI Tools — przepływ generowania", () => {
  for (const tool of TEXT_TOOLS) {
    test(`${tool.toolId}: renderuje się, woła generate z poprawnym kontraktem i pokazuje wynik`, async ({
      page,
    }) => {
      const tracker = installConsoleErrorTracker(page)
      await mockShellAccess(page, TILE_GRANT)
      await mockIdpConfig(page)
      await mockAiToolsHistory(page)
      const generate = await mockAiToolsGenerate(page)

      const workspace = new AiToolWorkspacePage(page, tool.toolId)
      await workspace.goto()

      // (a) przeszliśmy przez bramkę i widzimy właściwe narzędzie
      await expect(workspace.heading).toHaveText(tool.label)
      await expect(workspace.resultPlaceholder).toBeVisible()
      await expect(workspace.generateButton).toBeDisabled()

      // (b) input odblokowuje generowanie i wysyła żądanie
      await workspace.fillField(tool.inputLabel, tool.inputValue)
      await expect(workspace.generateButton).toBeEnabled()
      await workspace.generate()

      // (c) wynik ląduje na stronie
      await expect(workspace.resultContent).toHaveText(generate.content)

      expect(generate.requests).toHaveLength(1)
      const request = generate.requests[0]
      expect(request?.toolId).toBe(tool.toolId)
      expect(request?.userPrompt).toContain(tool.inputValue)
      expect(request?.systemPrompt?.length ?? 0).toBeGreaterThan(0)
      // Bez obrazu — te narzędzia nie są wizyjne.
      expect(request?.image).toBeUndefined()
      // Pola kosztowo-atrybucyjne wyprowadza serwer, klient ich nie wysyła.
      for (const field of SERVER_DERIVED_FIELDS) {
        expect(request).not.toHaveProperty(field)
      }

      expectNoConsoleErrors(tracker)
    })
  }

  test("błąd z /api/ai-tools/generate pokazuje komunikat, a nie pusty ekran", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockIdpConfig(page)
    await mockAiToolsHistory(page)
    const generate = await mockAiToolsGenerate(page, { status: 502 })

    const workspace = new AiToolWorkspacePage(page, "ai-summarizer")
    await workspace.goto()
    await workspace.fillField("Tekst", "Cokolwiek do streszczenia.")
    await workspace.generate()

    expect(generate.requests).toHaveLength(1)
    // Wynik się nie pojawia, placeholder zostaje — brak cichego "sukcesu".
    await expect(workspace.resultPlaceholder).toBeVisible()
  })
})
