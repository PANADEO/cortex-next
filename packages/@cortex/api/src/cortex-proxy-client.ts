// Adapter integracyjny do cortex-proxy (code-integration) — jedyne miejsce,
// z którego wolno wołać LLM. Wydzielony 1:1 z app/idp/app/api/ai-tools/generate/route.ts
// (patrz code-api/SKILL.md "znany dług"): kontroler nie buduje payloadów.
//
// UWAGA: ten plik jest server-side (Node). Świadomie NIE jest eksportowany
// z ./index.ts — barrel `@cortex/api` ciągnie React/react-query i "use client"
// (provider.tsx), czego route serwerowy nie powinien wciągać. Import przez
// subpath: `@cortex/api/cortex-proxy-client`.
//
// Kontrakt cortex-proxy jest ustalony empirycznie i działa produkcyjnie —
// zachowania poniżej (dwa kształty payloadu, kwas w temperaturze) są celowe,
// nie do "poprawienia" przy okazji.

const REQUEST_TIMEOUT_MS = 300_000

const DEFAULT_APP_LABEL = "AI Tools"
const DEFAULT_SOURCE_APP = "Cortex360 AI Tools"

export interface CortexProxyImage {
  dataUrl: string
  mimeType: string
}

export interface CortexProxyRequest {
  baseUrl: string
  email: string
  model: string
  scope: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
  image: CortexProxyImage | undefined
  /** Nagłówek X-App. Domyślnie "AI Tools" — zgodnie z dzisiejszym ruchem. */
  appLabel?: string
  /** Nagłówek X-Source-App. Wpływa na atrybucję zużycia tokenów po stronie
   *  cortex-proxy — nie zmieniać dla istniejącego ruchu AI Tools. */
  sourceApp?: string
}

export interface CortexProxyResult {
  content: string
  tokensUsed: number | null
  model: string
}

interface CortexChoice {
  message?: { content?: unknown }
  text?: unknown
}

interface CortexResponse {
  choices?: CortexChoice[]
  usage?: { total_tokens?: unknown }
}

export async function callCortexProxy(input: CortexProxyRequest): Promise<CortexProxyResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: buildCortexHeaders(input),
      body: JSON.stringify(buildCortexPayload(input)),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(text || `Cortex Proxy returned ${response.status}`)
    }

    const data = (await response.json()) as CortexResponse
    return {
      content: readCortexContent(data),
      model: input.model,
      tokensUsed: readTokensUsed(data),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildCortexHeaders(input: CortexProxyRequest): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-App": input.appLabel ?? DEFAULT_APP_LABEL,
    "X-Scope": input.scope,
    "X-Source-App": input.sourceApp ?? DEFAULT_SOURCE_APP,
    "X-User-ID": input.email,
  }

  const apiKey = process.env.CORTEX_PROXY_API_KEY ?? process.env.CORTEX_API_KEY
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

function buildCortexPayload(input: CortexProxyRequest): Record<string, unknown> {
  const maxTokensKey = isOpenRouterModel(input.model) ? "max_tokens" : "max_completion_tokens"
  const payload: Record<string, unknown> = {
    model: input.model,
    [maxTokensKey]: input.maxTokens,
  }

  if (isOpenRouterModel(input.model)) {
    payload.prompt = `${input.systemPrompt}\n\nUser: ${input.userPrompt}\n\nAssistant:`
    payload.temperature = input.temperature
    if (input.image) payload.image = input.image.dataUrl
    return payload
  }

  if (input.image) {
    payload.messages = [
      { role: "system", content: input.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: input.userPrompt },
          {
            type: "image_url",
            image_url: {
              url: input.image.dataUrl,
              detail: "high",
            },
          },
        ],
      },
    ]
  } else {
    payload.messages = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ]
  }

  // Te modele odrzucają jawną temperaturę różną od domyślnej — obejście realnego
  // ograniczenia upstreamu, zachowane dosłownie z pierwotnej implementacji.
  if (input.temperature !== 1 && !input.model.startsWith("o3") && !input.model.includes("gpt-5")) {
    payload.temperature = input.temperature
  }

  return payload
}

/** Modele OpenRouter mają w id ukośnik (np. "anthropic/claude-sonnet-4.6") — to
 *  rozstrzyga, którego kształtu payloadu oczekuje upstream. */
export function isOpenRouterModel(model: string): boolean {
  return model.includes("/")
}

function readCortexContent(data: CortexResponse): string {
  const firstChoice = data.choices?.[0]
  const content = firstChoice?.message?.content ?? firstChoice?.text
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Unexpected Cortex Proxy response")
  }
  return content
}

function readTokensUsed(data: CortexResponse): number | null {
  const value = data.usage?.total_tokens
  return typeof value === "number" ? value : null
}
