// Fakturomat (analizator faktur) — osobny plik od generate-flow.spec.ts, bo
// UI realnie się różni: nie ma pola tekstowego, wejściem jest plik, a payload
// niesie obraz dla modelu wizyjnego. To nie jest "ten sam formularz z innym
// labelem".
//
// Ścieżka PDF (renderPdfFileAsInvoiceImage → pdfjs w przeglądarce) świadomie
// NIE jest tu testowana — patrz notatka PROJECT/cortex-frontend-ai-tools-testy.md,
// sekcja "Co pominięte". Test pokrywa ścieżkę obrazu, która jest wspólnym
// wyjściem obu wariantów (PDF i tak jest konwertowany do obrazu przed wysyłką).

import { expect, test } from "@playwright/test"
import { AiToolWorkspacePage } from "../poms/ai-tools/tool-workspace-page"
import {
  mockAiToolsGenerate,
  mockAiToolsHistory,
  SERVER_DERIVED_FIELDS,
} from "../support/mocks/ai-tools-proxy"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

// Najmniejszy poprawny PNG (1x1). Treść obrazu nie ma znaczenia — model jest
// zamockowany; znaczenie ma to, że przeglądarka zrobi z niego data URL.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

test.describe("AI Tools — Fakturomat", () => {
  test("wgranie obrazu faktury woła generate z obrazem i pokazuje wynik", async ({ page }) => {
    await mockShellAccess(page, { email: EMAIL, apps: ["ai-tools"] })
    await mockIdpConfig(page)
    await mockAiToolsHistory(page)
    const generate = await mockAiToolsGenerate(page, {
      content: "Sprzedawca: ACME Sp. z o.o.\nKwota brutto: 1 230,00 PLN",
      model: "openai/gpt-4o-mini",
    })

    const workspace = new AiToolWorkspacePage(page, "fakturomat")
    await workspace.goto()

    await expect(workspace.heading).toHaveText("Analizator faktur")
    // Bez pliku nie ma czego analizować.
    await expect(workspace.generateButton).toBeDisabled()

    await workspace.uploadFile("Plik faktury", {
      name: "faktura.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    })
    await expect(workspace.generateButton).toBeEnabled()

    await workspace.generate()

    await expect(workspace.resultContent).toContainText("ACME")

    expect(generate.requests).toHaveLength(1)
    const request = generate.requests[0]
    expect(request?.toolId).toBe("fakturomat")
    expect(request?.image?.mimeType).toBe("image/png")
    expect(request?.image?.dataUrl.startsWith("data:image/png;base64,")).toBe(true)
    expect(request?.userPrompt).toContain("Przeanalizuj załączony obraz faktury")
    // scope ("invoice-analyzer"), model wizyjny i limit 12000 tokenów wyprowadza
    // serwer z `toolId` — dowód na wartościach docierających do cortex-proxy jest
    // w app/idp/app/api/ai-tools/generate-hardening.test.ts. Klient ma ich NIE wysyłać.
    for (const field of SERVER_DERIVED_FIELDS) {
      expect(request).not.toHaveProperty(field)
    }
  })
})
