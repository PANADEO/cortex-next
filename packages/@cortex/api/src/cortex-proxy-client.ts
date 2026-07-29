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

/** Bierze tylko to, czego faktycznie używa — dzięki temu ten sam kod nagłówków
 *  obsługuje ścieżkę tekstową i obrazkową bez rzutowań między ich typami. */
function buildCortexHeaders(input: {
  email: string
  scope: string
  appLabel?: string
  sourceApp?: string
}): Record<string, string> {
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

// ---------------------------------------------------------------------------
// Wyjście OBRAZKOWE (Ilustromat)
// ---------------------------------------------------------------------------
//
// Osobna funkcja, a nie flaga w callCortexProxy(), z trzech konkretnych
// powodów — każdy z nich to realna różnica kontraktu, nie kosmetyka:
//
//  1. `modalities: ["image","text"]` — callCortexProxy() nigdy tego nie wysyła.
//  2. Odpowiedź niesie obraz w choices[0].message.images[0].image_url.url jako
//     data URI; readCortexContent() RZUCA, gdy content nie jest niepustym
//     stringiem, więc ścieżka tekstowa nie potrafi tego odczytać.
//  3. PUŁAPKA: isOpenRouterModel() zwraca true dla każdego id z ukośnikiem,
//     w tym "google/gemini-3.1-flash-lite-image", i wtedy payload idzie gałęzią
//     `prompt`-string zamiast messages[]. Model obrazkowy MUSI dostać
//     messages[] — dokładnie tak, jak robi to produkcyjnie działający PoC
//     w Pythonie (core/cortex_client.py zawsze wysyła messages).
//
// callCortexProxy() zostaje NIETKNIĘTY — obsługuje działający produkcyjnie
// ruch AI Tools, a jego zachowania są celowe.

export interface CortexProxyImageMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface CortexProxyImageRequest {
  baseUrl: string
  email: string
  model: string
  scope: string
  messages: CortexProxyImageMessage[]
  temperature?: number
  appLabel?: string
  sourceApp?: string
  timeoutMs?: number
}

export interface CortexProxyImageResult {
  /** Data URI base64 prosto od upstreamu — dekodowanie należy do wołającego. */
  dataUrl: string
  model: string
  tokensUsed: number | null
}

interface CortexImageChoice {
  message?: {
    images?: { image_url?: { url?: unknown } }[]
  }
}

interface CortexImageResponse {
  choices?: CortexImageChoice[]
  usage?: { total_tokens?: unknown }
}

export class CortexProxyImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CortexProxyImageError"
  }
}

export async function callCortexProxyImage(
  input: CortexProxyImageRequest,
): Promise<CortexProxyImageResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: buildCortexHeaders(input),
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        modalities: ["image", "text"],
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new CortexProxyImageError(text || `Cortex Proxy returned ${response.status}`)
    }

    const data = (await response.json()) as CortexImageResponse
    return {
      dataUrl: readCortexImage(data),
      model: input.model,
      tokensUsed: readTokensUsed(data as CortexResponse),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function readCortexImage(data: CortexImageResponse): string {
  const images = data.choices?.[0]?.message?.images
  if (!Array.isArray(images) || images.length === 0) {
    throw new CortexProxyImageError(
      "Model obrazkowy nie zwrócił obrazu (możliwe odrzucenie promptu ze " +
        "względów bezpieczeństwa). Spróbuj zmienić opis pomysłu na ilustrację.",
    )
  }

  const url = images[0]?.image_url?.url
  if (typeof url !== "string" || !url.startsWith("data:")) {
    throw new CortexProxyImageError(
      "Nieoczekiwany format obrazu z cortex-proxy (oczekiwano data URI base64).",
    )
  }
  return url
}

/** Dekoduje data URI na bufor. Wydzielone, bo używa tego i generacja,
 *  i testy kontraktu odpowiedzi. */
export function decodeDataUrl(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",")
  if (comma === -1) throw new CortexProxyImageError("Data URI bez separatora ','")
  return Buffer.from(dataUrl.slice(comma + 1), "base64")
}
