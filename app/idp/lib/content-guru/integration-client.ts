// Adapter integracyjny do cortex-proxy (code-integration) — jedyne miejsce,
// z którego wolno wołać LLM dla Content Guru. Woła `callCortexProxy()`
// (@cortex/api/cortex-proxy-client) — dokładnie ta sama funkcja, której dziś
// używa app/idp/app/api/ai-tools/generate/route.ts i Ilustromat
// (app/idp/app/api/ilustromat/generate/route.ts) — jeden kanał LLM, zero
// nowego mikroserwisu (design doc D2).
//
// Faza 0: WYŁĄCZNIE ten adapter. Prompt builder (system/user prompt z
// szablonu + kontekstu klient/rynek + zakazanych fraz, design doc §3) i
// post-generacyjna walidacja zakazanych fraz (D5) są Faza 1/2 — żaden route
// jeszcze nie woła tej funkcji, to jest scaffolding gotowy pod Fazę 1.
//
// Model NIE jest dowolnym stringiem z żądania (legacy `llm_model` był) —
// `generateContent()` odrzuca fail-closed każdy model spoza
// `CONTENT_GURU_MODELS` (D3), zanim cokolwiek trafi do cortex-proxy.

import { callCortexProxy } from "@cortex/api/cortex-proxy-client"
import { APP_LABEL, SCOPES, SOURCE_APP, isAllowedContentGuruModel } from "./config"

export interface GenerateContentRequest {
  /** Zawsze `access.email` z `requireTileAccess()` — nigdy z body żądania
   *  (code-service "Rekordy per-user" — ta sama zasada dotyczy tożsamości
   *  przekazywanej dalej do cortex-proxy, nie tylko filtrów SQL). */
  email: string
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  /** Design doc D3: stała w kodzie po stronie wołającego (prompt-builder.ts,
   *  Faza 1) — 0.7 generacja treści, 0.3 mini-generatory. Ten adapter nie
   *  narzuca wartości, tylko ją przekazuje. */
  temperature: number
}

export interface GenerateContentResult {
  content: string
  tokensUsed: number | null
  model: string
}

/** Jeden typ błędu dla każdej przyczyny (brak konfiguracji, model spoza
 *  listy, błąd upstreamu) — kontroler (Faza 1, jeszcze nie zbudowany) łapie
 *  go i mapuje na czytelny kod HTTP, nigdy nie zakłada że cortex-proxy jest
 *  zawsze dostępny (code-integration). */
export class ContentGuruServiceError extends Error {
  constructor(
    message: string,
    readonly code: "not-configured" | "model-not-allowed" | "upstream-error",
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "ContentGuruServiceError"
  }
}

export async function generateContent(
  request: GenerateContentRequest,
): Promise<GenerateContentResult> {
  const baseUrl = process.env.CORTEX_PROXY_URL
  if (!baseUrl) {
    throw new ContentGuruServiceError(
      "CORTEX_PROXY_URL nie jest ustawione — Content Guru nie może wywołać LLM.",
      "not-configured",
    )
  }

  if (!isAllowedContentGuruModel(request.model)) {
    throw new ContentGuruServiceError(
      `Model "${request.model}" nie jest na liście dozwolonych modeli (CONTENT_GURU_MODELS).`,
      "model-not-allowed",
    )
  }

  try {
    const result = await callCortexProxy({
      baseUrl,
      email: request.email,
      model: request.model,
      scope: SCOPES.generation,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      image: undefined,
      appLabel: APP_LABEL,
      sourceApp: SOURCE_APP,
    })
    return result
  } catch (error) {
    throw new ContentGuruServiceError(
      "Błąd komunikacji z cortex-proxy.",
      "upstream-error",
      error,
    )
  }
}
