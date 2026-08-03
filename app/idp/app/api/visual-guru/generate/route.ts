// Kontroler HTTP (code-api) — cienki: parse -> auth -> deleguj -> odpowiedz.
// Budowanie promptu żyje w lib/visual-guru/prompts.ts, wywołanie modelu w
// lib/visual-guru/integration-client.ts, zapis archiwum w
// @cortex/service/src/visual-guru.ts (createGeneration, Faza 0). Ten plik nie
// buduje payloadów ani nie dotyka Drizzle bezpośrednio.

import { createGeneration } from "@cortex/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { visualGuruConfig } from "@/lib/visual-guru/config"
import { generateVariants } from "@/lib/visual-guru/integration-client"
import { buildModelPrompt, FIDELITY_KEYS } from "@/lib/visual-guru/prompts"
import { requireVisualGuruAccess, toErrorResponse, toUpstreamErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

// D6/§6.1 (design doc): limit 1-3 obrazów referencyjnych, pochodna
// Server.MaxRequestSize=12MB skonfigurowanego na cortex-proxy — duplikowana
// tu jako magiczna liczba świadomie (client i server to dwa różne bundle'e,
// wzorem duplikacji use-object-url.ts z sekcji 1.2 design docu).
const MAX_REFERENCE_IMAGES = 3
const VARIANT_COUNTS = [2, 4] as const

const DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,/

const referenceImageSchema = z.object({
  dataUrl: z.string().regex(DATA_URL_PATTERN, "invalid-data-url"),
  fileName: z.string().min(1).max(255).optional(),
})

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  additionalContext: z
    .string()
    .max(2000)
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined)),
  referenceImages: z.array(referenceImageSchema).max(MAX_REFERENCE_IMAGES).default([]),
  fidelity: z.enum(FIDELITY_KEYS).optional(),
  variantCount: z.union([z.literal(VARIANT_COUNTS[0]), z.literal(VARIANT_COUNTS[1])]).default(2),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await requireVisualGuruAccess(request)
  if (!access.allowed) return access.response

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const baseUrl = process.env.CORTEX_PROXY_URL
  if (!baseUrl) {
    console.error("[visual-guru] CORTEX_PROXY_URL nie jest ustawione")
    return NextResponse.json({ error: "proxy-not-configured" }, { status: 502 })
  }

  const { prompt, additionalContext, referenceImages, fidelity, variantCount } = parsed.data
  const config = visualGuruConfig()
  const hasReferenceImages = referenceImages.length > 0

  // Prompt WYSYŁANY do modelu (dopisek o wierności doklejony tutaj) różni się
  // świadomie od tego, co trafia do archiwum niżej — patrz komentarz w
  // lib/visual-guru/prompts.ts.
  const modelPrompt = buildModelPrompt({ prompt, additionalContext, fidelity, hasReferenceImages })

  let generatedVariants: Awaited<ReturnType<typeof generateVariants>>
  try {
    generatedVariants = await generateVariants({
      baseUrl,
      email: access.email,
      model: config.imageModel,
      prompt: modelPrompt,
      referenceImages: referenceImages.map((image) => ({ dataUrl: image.dataUrl })),
      variantCount,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "CortexProxyImageError") {
      return toUpstreamErrorResponse(error)
    }
    return toErrorResponse(error)
  }

  try {
    const referenceImageFileName = hasReferenceImages
      ? referenceImages
          .map((image) => image.fileName)
          .filter((name): name is string => Boolean(name))
          .join(", ") || null
      : null

    const generation = await createGeneration(access.email, {
      // Archiwum przechowuje surowy prompt/kontekst usera (Faza 2, historia) —
      // NIE tekst faktycznie wysłany do modelu (ten niesie dopisek o
      // wierności, który jest szczegółem generacji, nie treścią zapytania).
      prompt,
      additionalContext: additionalContext ?? null,
      hadReferenceImage: hasReferenceImages,
      referenceImageFileName,
      model: config.imageModel,
      variants: generatedVariants.map((variant, index) => ({
        variantIndex: index,
        image: variant.image,
        contentType: variant.contentType,
      })),
    })

    return NextResponse.json({
      id: generation.id,
      prompt: generation.prompt,
      additionalContext: generation.additionalContext,
      model: generation.model,
      variantCount: generation.variantCount,
      hadReferenceImage: generation.hadReferenceImage,
      createdAt: generation.createdAt,
      variants: generation.variants.map((variant) => ({
        variantIndex: variant.variantIndex,
        dataUrl: `data:${variant.contentType};base64,${variant.image.toString("base64")}`,
      })),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
