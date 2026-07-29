// Bramka dostępu do AI Tools widziana z przeglądarki.
//
// To jest dowód na warstwę UI. Dowód na ścieżkę ŻĄDANIA (że route odmawia
// niezależnie od tego, co pokazuje UI) żyje w
// app/idp/app/api/ai-tools/guard-coverage.test.ts — jedno bez drugiego nie
// wystarcza i to właśnie ta druga warstwa bywa pomijana.

import { expect, test } from "@playwright/test"
import { AiToolWorkspacePage } from "../poms/ai-tools/tool-workspace-page"
import { mockAiToolsGenerate, mockAiToolsHistory } from "../support/mocks/ai-tools-proxy"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

test.describe("AI Tools — bramka dostępu w UI", () => {
  test("użytkownik bez żadnego grantu na AI Tools nie wchodzi do narzędzia", async ({ page }) => {
    await mockShellAccess(page, { email: EMAIL, apps: ["idp"] })
    await mockIdpConfig(page)
    await mockAiToolsHistory(page)
    const generate = await mockAiToolsGenerate(page)

    const workspace = new AiToolWorkspacePage(page, "ai-summarizer")
    await workspace.goto()

    await expect(workspace.accessDeniedShell).toBeVisible()
    await expect(workspace.generateButton).toHaveCount(0)
    // Odmowa nie może po drodze wywołać generowania.
    expect(generate.requests).toHaveLength(0)
  })

  test("grant na jedno narzędzie nie otwiera innego", async ({ page }) => {
    // Uprawnienie tylko do Sumaryzatora...
    await mockShellAccess(page, { email: EMAIL, apps: ["ai-summarizer"] })
    await mockIdpConfig(page)
    await mockAiToolsHistory(page)
    await mockAiToolsGenerate(page)

    // ...a wchodzimy do Analizatora.
    const foreign = new AiToolWorkspacePage(page, "text-analyzer")
    await foreign.goto()
    await expect(foreign.accessDeniedShell).toBeVisible()

    // Własne narzędzie nadal działa — to nie jest globalna odmowa.
    const own = new AiToolWorkspacePage(page, "ai-summarizer")
    await own.goto()
    await expect(own.heading).toHaveText("Sumaryzator")
  })

  test("nieznany slug narzędzia nie renderuje workspace'u", async ({ page }) => {
    await mockShellAccess(page, { email: EMAIL, apps: ["ai-tools"] })
    await mockIdpConfig(page)
    await mockAiToolsHistory(page)
    await mockAiToolsGenerate(page)

    const workspace = new AiToolWorkspacePage(page, "narzedzie-ktore-nie-istnieje")
    await workspace.goto()

    await expect(workspace.generateButton).toHaveCount(0)
  })
})
