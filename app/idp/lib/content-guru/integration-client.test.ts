import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { callCortexProxy } from "@cortex/api/cortex-proxy-client"
import { ContentGuruServiceError, generateContent, type GenerateContentRequest } from "./integration-client"

vi.mock("@cortex/api/cortex-proxy-client", () => ({
  callCortexProxy: vi.fn(),
}))

const REQUEST: GenerateContentRequest = {
  email: "user@example.com",
  model: "anthropic/claude-sonnet-4.6",
  systemPrompt: "system",
  userPrompt: "user",
  maxTokens: 4000,
  temperature: 0.7,
}

describe("generateContent", () => {
  beforeEach(() => {
    vi.stubEnv("CORTEX_PROXY_URL", "http://localhost:8240")
    vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-sonnet-4.6,openai/gpt-4o-mini")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(callCortexProxy).mockReset()
  })

  it("woła callCortexProxy z modelem/scope/nagłówkami content-guru i zwraca wynik", async () => {
    vi.mocked(callCortexProxy).mockResolvedValueOnce({
      content: "wygenerowana treść",
      tokensUsed: 123,
      model: REQUEST.model,
    })

    const result = await generateContent(REQUEST)

    expect(callCortexProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://localhost:8240",
        email: REQUEST.email,
        model: REQUEST.model,
        scope: "content-guru-generation",
        systemPrompt: REQUEST.systemPrompt,
        userPrompt: REQUEST.userPrompt,
        maxTokens: REQUEST.maxTokens,
        temperature: REQUEST.temperature,
        appLabel: "Content Guru",
        sourceApp: "Cortex360 Content Guru",
      }),
    )
    expect(result).toEqual({ content: "wygenerowana treść", tokensUsed: 123, model: REQUEST.model })
  })

  it("odmawia fail-closed, gdy CORTEX_PROXY_URL nie jest ustawione — nie woła cortex-proxy", async () => {
    vi.stubEnv("CORTEX_PROXY_URL", "")

    await expect(generateContent(REQUEST)).rejects.toMatchObject({
      name: "ContentGuruServiceError",
      code: "not-configured",
    })
    expect(callCortexProxy).not.toHaveBeenCalled()
  })

  it("odmawia fail-closed model spoza CONTENT_GURU_MODELS — nie woła cortex-proxy", async () => {
    await expect(
      generateContent({ ...REQUEST, model: "nieznany/model" }),
    ).rejects.toMatchObject({
      name: "ContentGuruServiceError",
      code: "model-not-allowed",
    })
    expect(callCortexProxy).not.toHaveBeenCalled()
  })

  it("mapuje błąd cortex-proxy na ContentGuruServiceError", async () => {
    vi.mocked(callCortexProxy).mockRejectedValue(new Error("upstream boom"))

    await expect(generateContent(REQUEST)).rejects.toBeInstanceOf(ContentGuruServiceError)
    await expect(generateContent(REQUEST)).rejects.toMatchObject({ code: "upstream-error" })
  })
})
