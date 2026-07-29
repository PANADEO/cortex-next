// Granica "poza modułem" dla testów E2E AI Tools.
//
// AI Tools wywołuje LLM przez cortex-proxy (packages/@cortex/api/src/cortex-proxy-client.ts),
// ale z poziomu przeglądarki jedynym przechwytywalnym punktem jest własny
// route BFF `/api/ai-tools/generate`. Dlatego mockujemy JEGO, nie cortex-proxy
// bezpośrednio — wzorem e2e/issue-66/helpers.ts, gdzie `page.route` jest
// jedynym interceptorem (MSW wyłączone przez NEXT_PUBLIC_API_MOCKING=disabled).
//
// KONSEKWENCJA, o której trzeba pamiętać: przy tym mocku serwerowy handler
// route'a (a więc i jego RBAC — getAccessResult/canAccessAiTool) NIE wykonuje
// się w ogóle. Bramka po stronie żądania jest dowodzona osobno, w
// app/idp/app/api/ai-tools/guard-coverage.test.ts. Testy E2E dowodzą warstwy
// UI: że formularz zbiera input, wysyła poprawny kontrakt i renderuje wynik.

import type { Page, Route } from "@playwright/test"

/** Kontrakt żądania z app/idp/lib/ai-tools/api.ts (AiToolGenerateRequest). */
export interface CapturedGenerateRequest {
  toolId: string
  scope: string
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  image?: { dataUrl: string; mimeType: string }
}

export interface GenerateMockOptions {
  content?: string
  model?: string
  tokensUsed?: number | null
  /** Gdy ustawione, route odpowiada tym statusem zamiast 200. */
  status?: number
}

export interface GenerateMock {
  /** Żądania, które faktycznie wyszły z przeglądarki — w kolejności wysyłki. */
  readonly requests: CapturedGenerateRequest[]
  readonly content: string
  readonly model: string
}

export const DEFAULT_GENERATED_CONTENT =
  "WYNIK TESTOWY: to jest odpowiedź zwrócona przez zamockowany cortex-proxy."

export async function mockAiToolsGenerate(
  page: Page,
  options: GenerateMockOptions = {},
): Promise<GenerateMock> {
  const content = options.content ?? DEFAULT_GENERATED_CONTENT
  const model = options.model ?? "anthropic/claude-sonnet-4.6"
  const tokensUsed = options.tokensUsed === undefined ? 1234 : options.tokensUsed
  const status = options.status ?? 200
  const requests: CapturedGenerateRequest[] = []

  await page.route("**/api/ai-tools/generate", async (route: Route) => {
    const payload = route.request().postDataJSON() as CapturedGenerateRequest
    requests.push(payload)

    if (status !== 200) {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ error: "mocked-failure" }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content, model, tokensUsed }),
    })
  })

  return { requests, content, model }
}

/** Historia jest tu szumem — bez mocka panel pokazuje błąd (route zwraca 401,
 *  bo lokalny dev server nie ma DEV_USER_EMAIL po stronie serwera). */
export async function mockAiToolsHistory(page: Page, items: unknown[] = []): Promise<void> {
  await page.route("**/api/ai-tools/history*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    })
  })
}
