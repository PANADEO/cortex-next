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
//
// Jeden adapter na serwis zewnętrzny, nie plik na wywołanie (code-integration):
// stąd fetchProxyUsage() na dole tego pliku obok wywołań LLM, choć woła zupełnie
// inny endpoint i uwierzytelnia się innym sekretem.

import { z } from "zod"

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

/** Ten sam kształt części contentu, którego callCortexProxy()'s buildCortexPayload()
 *  już używa dla wejścia wizyjnego (analiza obrazu przez model tekstowy) — nie nowy
 *  wynalazek, zastosowanie istniejącego, sprawdzonego wzorca do siostrzanej funkcji
 *  obrazkowej. cortex-proxy już rozumie ten kształt jako string ALBO tablicę części
 *  (pkg/proxy/anonymize.go, isTextPart() — zweryfikowane w źródle Go, nie założone,
 *  patrz PROJECT/cortex-frontend-visual-guru-tile-projekt.md sekcja 1.5/3). */
export type CortexProxyImageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }

export interface CortexProxyImageMessage {
  role: "system" | "user" | "assistant"
  /** `string` zostaje pierwszym, wciąż legalnym wariantem — Ilustromatu (jedynego
   *  dzisiejszego wołającego) ani ta zmiana typu, ani zero linii runtime poniżej
   *  nie dotyka: callCortexProxyImage() przekazuje `input.messages` verbatim,
   *  nigdy nie inspekcjonuje kształtu `.content`. Tablica części to nowy,
   *  opt-in kształt dla wołających z obrazem referencyjnym (Visual Guru). */
  content: string | CortexProxyImageContentPart[]
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

// ---------------------------------------------------------------------------
// Raportowanie zużycia tokenów (GET /usage)
// ---------------------------------------------------------------------------
//
// Zupełnie inna oś niż reszta pliku: nie /v1/chat/completions, nie POST,
// i przede wszystkim INNY SEKRET.
//
//   CORTEX_PROXY_API_KEY        -> Authorization: Bearer, dla /v1/chat/completions.
//                                  Proxy i tak NADPISUJE go kluczem upstreamu
//                                  przed wysłaniem dalej (proxy.go:436).
//   CORTEX_PROXY_ADMIN_API_KEY  -> X-Admin-API-Key, sprawdzany przez UsageHandler
//                                  przeciwko cfg.Auth.AdminAPIKey (ADMIN_API_KEY
//                                  w env cortex-proxy).
//
// Pomylenie ich daje ciche 401. Dlatego klucz jest tu JAWNYM ARGUMENTEM, a nie
// czytany z process.env jak w buildCortexHeaders() — wołający ma go podać
// świadomie, a config modułu ma go wcześniej zwalidować.
//
// BEZPIECZEŃSTWO: klucz idzie WYŁĄCZNIE nagłówkiem. cortex-proxy akceptuje też
// `?api_key=`, ale query string ląduje w logach dostępu (proxy, reverse proxy,
// przeglądarka) — ta ścieżka jest tu świadomie niedostępna. Żaden komunikat
// błędu z tej funkcji nie niesie klucza ani URL-a z parametrami.

/** Domyślny timeout: /usage to jedno GROUP BY po SQLite, nie generacja. */
const USAGE_TIMEOUT_MS = 30_000

/** Kontrakt odczytany z config.UsageSummary (pkg/config/database.go:226-238)
 *  i potwierdzony testem pkg/proxy/usage_handler_test.go. Go nie używa
 *  `omitempty` na żadnym z tych pól, więc komplet jest zawsze obecny —
 *  brak któregokolwiek to realna zmiana kontraktu, nie wariant do tolerowania. */
const usageRowSchema = z.object({
  user_id: z.string(),
  source_app: z.string(),
  scope: z.string(),
  model: z.string(),
  request_tokens: z.number(),
  response_tokens: z.number(),
  reasoning_tokens: z.number(),
  cached_tokens: z.number(),
  total_tokens: z.number(),
  request_count: z.number(),
})

const usageResponseSchema = z.array(usageRowSchema)

export type CortexProxyUsageRow = z.infer<typeof usageRowSchema>

/**
 * Rodzaj awarii, nie tekst — route mapuje to na kod HTTP dla przeglądarki.
 * Rozróżnienie ma znaczenie operacyjne: "unauthorized" to zła konfiguracja
 * u NAS (nie wina użytkownika), "unreachable" to niedostępny cudzy serwis.
 */
export type CortexProxyUsageFailure =
  "unauthorized" | "invalid-range" | "upstream-error" | "unreachable" | "malformed-response"

export class CortexProxyUsageError extends Error {
  readonly failure: CortexProxyUsageFailure
  readonly status: number | null

  constructor(failure: CortexProxyUsageFailure, message: string, status: number | null = null) {
    super(message)
    this.name = "CortexProxyUsageError"
    this.failure = failure
    this.status = status
  }
}

export interface CortexProxyUsageRequest {
  baseUrl: string
  /** Wartość ADMIN_API_KEY z cortex-proxy. NIE CORTEX_PROXY_API_KEY. */
  adminApiKey: string
  /** YYYY-MM-DD. Bez konwersji stref — proxy parsuje w swojej TIMEZONE. */
  start: string
  /** YYYY-MM-DD, INKLUZYWNY po stronie proxy (+23:59:59). */
  end: string
  timeoutMs?: number
}

export async function fetchProxyUsage(
  input: CortexProxyUsageRequest,
): Promise<CortexProxyUsageRow[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? USAGE_TIMEOUT_MS)

  // URLSearchParams, nie konkatenacja — daty są walidowane wcześniej, ale
  // budowanie query stringu ręcznie to dokładnie ta klasa kodu, w której
  // kiedyś ląduje sekret przez pomyłkę.
  const query = new URLSearchParams({ start: input.start, end: input.end })
  const url = `${input.baseUrl.replace(/\/$/, "")}/usage?${query.toString()}`

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Admin-API-Key": input.adminApiKey,
      },
      signal: controller.signal,
      cache: "no-store",
    })
  } catch {
    // Komunikat celowo własny, a wyjątek świadomie NIE jest przekazywany dalej:
    // treść błędu warstwy sieciowej potrafi zawierać pełny URL żądania, a ten
    // nie ma prawa trafić do logu ani do klienta.
    const reason = controller.signal.aborted ? "przekroczono limit czasu" : "brak połączenia"
    throw new CortexProxyUsageError("unreachable", `cortex-proxy nieosiągalny (${reason})`)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) throw toUsageFailure(response.status)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new CortexProxyUsageError(
      "malformed-response",
      "cortex-proxy zwrócił odpowiedź, której nie da się sparsować jako JSON",
      response.status,
    )
  }

  const parsed = usageResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new CortexProxyUsageError(
      "malformed-response",
      `odpowiedź /usage nie pasuje do kontraktu: ${parsed.error.issues[0]?.message ?? "nieznany błąd"}`,
      response.status,
    )
  }

  return parsed.data
}

/** Ciało odpowiedzi błędu NIE jest przepuszczane dalej — http.Error() po stronie
 *  Go zwraca gołe teksty, a echo cudzego stringa do naszego klienta to zbędna
 *  powierzchnia. Sam status wystarcza, żeby rozróżnić przypadki. */
function toUsageFailure(status: number): CortexProxyUsageError {
  if (status === 401) {
    return new CortexProxyUsageError(
      "unauthorized",
      "cortex-proxy odrzucił klucz administracyjny (sprawdź CORTEX_PROXY_ADMIN_API_KEY)",
      status,
    )
  }
  if (status === 400) {
    return new CortexProxyUsageError("invalid-range", "cortex-proxy odrzucił zakres dat", status)
  }
  return new CortexProxyUsageError("upstream-error", `cortex-proxy zwrócił ${status}`, status)
}
