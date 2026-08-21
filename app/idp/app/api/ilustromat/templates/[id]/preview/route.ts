// Live preview kreatora szablonów.
//
// TWARDY WYMÓG PRODUKTU: preview idzie DOKŁADNIE tą samą funkcją compose(),
// co produkcyjna generacja — zero osobnej ścieżki renderowania, więc nie ma jak
// powstać rozjazd "w kreatorze wyglądało inaczej niż na gotowym kafelku".
//
// Szablon przychodzi w ciele jako SZKIC (jeszcze niezapisany — kreator
// przelicza podgląd przy każdym ruchu suwaka). Id w ścieżce służy wyłącznie
// do dociągnięcia assetów (własny font/logo) istniejącego szablonu; dla nowego
// szablonu klient wysyła NEW_TEMPLATE_ID i podgląd leci na foncie z biblioteki.
//
// Tło: deterministyczny gradient ze stałym ziarnem. W PoC ten sam efekt dawało
// @st.cache_data — bez tego każdy ruch suwaka koloru migotał nowym losowym tłem.

import { compose } from "@/lib/ilustromat/composer"
import { sampleGradientImage } from "@/lib/ilustromat/gradient"
import { FORMAT_BY_KEY, SUBTITLE_MAX_CHARS, TITLE_MAX_CHARS } from "@/lib/ilustromat/presets"
import { draftToFrameTemplate, resolveTemplateFonts } from "@/lib/ilustromat/render"
import { frameTemplateInputSchema, getTemplateAsset } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessTemplateManager, toErrorResponse } from "../../../_lib/guard"

export const runtime = "nodejs"

/** Sentinel dla szablonu, który jeszcze nie istnieje w bazie. */
export const NEW_TEMPLATE_ID = "nowy"

type Context = { params: Promise<{ id: string }> }

const requestSchema = z.object({
  template: frameTemplateInputSchema,
  title: z.string().max(TITLE_MAX_CHARS).default("Przykładowy tytuł posta"),
  subtitle: z.string().max(SUBTITLE_MAX_CHARS).default("Podtytuł, czyli hasło uzupełniające"),
  formatKey: z.string().default("square"),
})

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessTemplateManager(request)
  if (denied) return denied

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const format = FORMAT_BY_KEY.get(parsed.data.formatKey)
  if (!format) return NextResponse.json({ error: "unknown-format" }, { status: 400 })

  const { id } = await context.params

  try {
    const template = draftToFrameTemplate(parsed.data.template, id)
    const fonts = await resolveTemplateFonts(template)
    const logo =
      id === NEW_TEMPLATE_ID ? null : ((await getTemplateAsset(id, "logo"))?.bytes ?? null)

    const png = await compose({
      background: await sampleGradientImage({
        width: format.width,
        height: format.height,
        seed: `podglad-${format.key}`,
      }),
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      format,
      template,
      fonts,
      logo,
    })

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
