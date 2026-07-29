// Rekompozycja BEZ AI (REQ-08). Najczęściej wołany endpoint modułu: leci przy
// każdej zmianie tytułu/podtytułu (debounce po stronie UI), więc musi być tani.
// Tło przychodzi w ciele żądania — historia generacji nie jest utrwalana
// w MVP (parytet z PoC), więc klient oddaje z powrotem to, co dostał.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { compose } from "@/lib/ilustromat/composer"
import { FORMAT_BY_KEY, SUBTITLE_MAX_CHARS, TITLE_MAX_CHARS } from "@/lib/ilustromat/presets"
import { resolveTemplateRender } from "@/lib/ilustromat/render"
import { denyUnlessAllowed, toErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z.object({
  templateId: z.string().min(1),
  formatKey: z.string().min(1),
  title: z.string().max(TITLE_MAX_CHARS),
  subtitle: z.string().max(SUBTITLE_MAX_CHARS).default(""),
  /** Tło jako data URI albo goły base64 — tak jak klient je dostał. */
  background: z.string().min(1),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const format = FORMAT_BY_KEY.get(parsed.data.formatKey)
  if (!format) {
    return NextResponse.json({ error: "unknown-format" }, { status: 400 })
  }

  try {
    const { template, fonts, logo } = await resolveTemplateRender(parsed.data.templateId)
    const png = await compose({
      background: decodeBackground(parsed.data.background),
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      format,
      template,
      fonts,
      logo,
    })

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // Wynik zależy wyłącznie od ciała żądania; cache po stronie
        // przeglądarki tylko myliłby przy szybkim pisaniu.
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

function decodeBackground(value: string): Buffer {
  const comma = value.indexOf(",")
  const base64 = value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value
  return Buffer.from(base64, "base64")
}
