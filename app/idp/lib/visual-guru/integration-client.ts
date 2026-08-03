// Adapter integracyjny do cortex-proxy (code-integration) — jedyne miejsce w
// tym module, z którego wolno wołać LLM. Rozdzielony od kontrolera od razu
// (code-api/SKILL.md "znany dług": nowe route'y piszą to osobno, nie kopiują
// generate/route.ts 1:1).
//
// Ścieżka B (D4, design doc sekcja 3): obraz referencyjny leci jako część
// multi-part `content` na /v1/chat/completions — TEN SAM endpoint i model,
// który Ilustromat już używa produkcyjnie. Zero nowego kontraktu HTTP wobec
// cortex-proxy, tylko nowy, opt-in kształt wywołania istniejącego
// callCortexProxyImage() (rozszerzenie typu potwierdzone wstecznie zgodne w
// packages/@cortex/api/src/cortex-proxy-client.ts).

import {
  callCortexProxyImage,
  decodeDataUrl,
  type CortexProxyImageContentPart,
  type CortexProxyImageMessage,
} from "@cortex/api/cortex-proxy-client"
import { APP_LABEL, SCOPES, SOURCE_APP } from "./config"

const IMAGE_TIMEOUT_MS = 90_000

export interface ReferenceImageInput {
  dataUrl: string
}

export interface GenerateVariantsInput {
  baseUrl: string
  email: string
  model: string
  /** Prompt JUŻ złożony (buildModelPrompt() z ./prompts) — ten adapter nie
   *  wie nic o "wierności"/dodatkowym kontekście, tylko wysyła gotową treść. */
  prompt: string
  referenceImages: ReferenceImageInput[]
  variantCount: number
}

export interface GeneratedVariant {
  image: Buffer
  contentType: string
}

/** string, gdy brak referencji (identyczny kształt co Ilustromat — zero
 *  zmiany zachowania dla przypadku bez obrazu), tablica multi-part części
 *  gdy ≥1 obraz referencyjny — dokładnie kontrakt z design doc sekcja 3. */
function buildContent(
  prompt: string,
  referenceImages: ReferenceImageInput[],
): CortexProxyImageMessage["content"] {
  if (referenceImages.length === 0) return prompt

  const parts: CortexProxyImageContentPart[] = [
    { type: "text", text: prompt },
    ...referenceImages.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.dataUrl, detail: "high" as const },
    })),
  ]
  return parts
}

/** N RÓWNOLEGŁYCH wywołań modelu obrazkowego (Promise.all, wzorem
 *  Ilustromatu) — jedno wywołanie na wariant, ten sam prompt/referencje za
 *  każdym razem (modele obrazkowe przez ten endpoint nie przyjmują "zwróć N
 *  wariantów naraz"). */
export async function generateVariants(input: GenerateVariantsInput): Promise<GeneratedVariant[]> {
  const content = buildContent(input.prompt, input.referenceImages)
  const messages: CortexProxyImageMessage[] = [{ role: "user", content }]

  const results = await Promise.all(
    Array.from({ length: input.variantCount }, () =>
      callCortexProxyImage({
        baseUrl: input.baseUrl,
        email: input.email,
        model: input.model,
        scope: SCOPES.generation,
        messages,
        appLabel: APP_LABEL,
        sourceApp: SOURCE_APP,
        timeoutMs: IMAGE_TIMEOUT_MS,
      }),
    ),
  )

  return results.map((result) => ({
    image: decodeDataUrl(result.dataUrl),
    contentType: parseDataUrlContentType(result.dataUrl),
  }))
}

/** Odczytuje deklarowany typ MIME z data URI zamiast go zakładać. Sprawdzone
 *  realnym wywołaniem modelu (weryfikacja Fazy 1): model obrazkowy zwraca
 *  JPEG, nie PNG mimo domyślnej nazwy zmiennej `imageModel`/nazw plików w
 *  Ilustromacie — Visual Guru, w przeciwieństwie do Ilustromatu, NIE
 *  re-koduje wyniku przez compose()/sharp (D6: surowy wynik AI to produkt
 *  końcowy), więc zapisany/serwowany typ MIME musi zgadzać się z realnymi
 *  bajtami, inaczej data URI/nazwa pliku pobrania kłamią o formacie. */
function parseDataUrlContentType(dataUrl: string): string {
  const match = /^data:([^;,]+);base64,/.exec(dataUrl)
  return match?.[1] ?? "image/png"
}
