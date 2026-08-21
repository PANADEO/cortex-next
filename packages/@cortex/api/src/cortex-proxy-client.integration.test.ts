// Test integracyjny — PRAWDZIWE wywołanie cortex-proxy, bez mocków.
//
// Domyślnie POMIJANY: bez zmiennej CORTEX_PROXY_URL `pnpm test` zostaje zielony
// i nie wymaga stojącej infrastruktury. Uruchomienie na żywo:
//
//   cd ~/REPO/cortex-proxy && docker compose up -d
//   CORTEX_PROXY_URL=http://localhost:8240 pnpm vitest run \
//     packages/@cortex/api/src/cortex-proxy-client.integration.test.ts
//
// Sens: testy jednostkowe na zamockowanym fetch potwierdzają KSZTAŁT payloadu,
// ale nie to, czy cortex-proxy ten kształt faktycznie akceptuje. To sprawdza
// dopiero ten plik.

import { describe, expect, it } from "vitest"
import { callCortexProxy } from "./cortex-proxy-client"

const baseUrl = process.env.CORTEX_PROXY_URL
const model = process.env.CORTEX_PROXY_TEST_MODEL ?? "openai/gpt-5.4-nano"

describe.skipIf(!baseUrl)("callCortexProxy — realny cortex-proxy", () => {
  it("wykonuje prawdziwe wywołanie i zwraca treść", { timeout: 120_000 }, async () => {
    const result = await callCortexProxy({
      appLabel: "Integration Test",
      baseUrl: baseUrl as string,
      email: "integration-test@cortex.local",
      image: undefined,
      maxTokens: 512,
      model,
      scope: "summarizer",
      sourceApp: "Cortex360 Integration Test",
      systemPrompt: "Odpowiadasz wyłącznie jednym słowem, bez interpunkcji.",
      temperature: 1,
      userPrompt: "Napisz dokładnie jedno słowo: test",
    })

    expect(typeof result.content).toBe("string")
    expect(result.content.trim().length).toBeGreaterThan(0)
    expect(result.model).toBe(model)
    expect(result.tokensUsed === null || typeof result.tokensUsed === "number").toBe(true)
  })

  it("mapuje odrzucenie nieznanego modelu na wyjątek", { timeout: 60_000 }, async () => {
    await expect(
      callCortexProxy({
        baseUrl: baseUrl as string,
        email: "integration-test@cortex.local",
        image: undefined,
        maxTokens: 512,
        model: "nieistniejacy/model-ktorego-nie-ma",
        scope: "summarizer",
        systemPrompt: "system",
        temperature: 1,
        userPrompt: "user",
      }),
    ).rejects.toThrow()
  })
})
