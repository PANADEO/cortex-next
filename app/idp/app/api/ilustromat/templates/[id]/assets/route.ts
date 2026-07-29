// Wgrywanie assetów szablonu: własny font (regular/bold) i logo.
//
// Font przechodzi WERYFIKACJĘ przed zapisem — pokrycie polskich znaków plus
// odczyt nazwy rodziny. Nazwa jest zapisywana razem z plikiem, bo opis Pango
// musi ją podać dosłownie; bez tego Pango po cichu dobiera inny krój i kafelek
// wychodzi "prawie dobry" (LUKA 3 projektu).
//
// Logo jest normalizowane do jednego PNG z alfą niezależnie od formatu
// źródłowego (PNG/JPG/SVG), żeby composer czytał zawsze to samo.

import { getFrameTemplate, saveTemplateAsset } from "@cortex/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { materializeFont, sha256 } from "@/lib/ilustromat/font-cache"
import {
  FontVerificationError,
  supportsFontFiles,
  verifyFontRendering,
  type FontVerificationInput,
} from "@/lib/ilustromat/font-verification"
import { inspectFont } from "@/lib/ilustromat/glyph-coverage"
import { normalizeLogoToPng } from "@/lib/ilustromat/logo"
import { denyUnlessTemplateManager, toErrorResponse } from "../../../_lib/guard"

export const runtime = "nodejs"

const MAX_ASSET_BYTES = 5 * 1024 * 1024
const ASSET_KINDS = ["font-regular", "font-bold", "logo"] as const
type AssetKind = (typeof ASSET_KINDS)[number]

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessTemplateManager(request)
  if (denied) return denied

  const { id } = await context.params

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const kind = form.get("kind")
  const file = form.get("file")
  if (typeof kind !== "string" || !ASSET_KINDS.includes(kind as AssetKind)) {
    return NextResponse.json({ error: "invalid-kind" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 })
  }
  if (file.size > MAX_ASSET_BYTES) {
    return NextResponse.json({ error: "file-too-large" }, { status: 413 })
  }

  try {
    if (!(await getFrameTemplate(id))) {
      return NextResponse.json({ error: "not-found" }, { status: 404 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())

    if (kind === "logo") {
      const normalized = await normalizeLogoToPng(bytes, file.name)
      await saveTemplateAsset({
        templateId: id,
        kind: "logo",
        contentType: "image/png",
        bytes: normalized,
        sha256: sha256(normalized),
        originalFilename: file.name,
      })
      return NextResponse.json({ kind: "logo", bytes: normalized.length })
    }

    const inspection = inspectFont(bytes)
    if (inspection.missingPolishChars.length > 0) {
      // Odmowa, nie ostrzeżenie: font bez polskich znaków łamie twarde
      // wymaganie produktu ("nigdy nie ma krzywych polskich znaków").
      return NextResponse.json(
        {
          error: "missing-polish-glyphs",
          missing: inspection.missingPolishChars,
          message: `Font nie zawiera wymaganych polskich znaków: ${inspection.missingPolishChars.join(" ")}`,
        },
        { status: 400 },
      )
    }

    // Bramka renderu weryfikacyjnego: fontkit powiedział tylko, że plik daje się
    // sparsować i ma polskie znaki. Dopiero próbny render mówi, czy TEN plik
    // faktycznie składa tekst — plik uszkodzony i rozjazd nazwy rodziny kończą
    // się tak samo (cichy font zastępczy), więc zamykamy je razem, TU, a nie
    // przy każdym compose().
    const digest = sha256(bytes)
    const verification = await verifyUploadedFont({
      bytes,
      family: inspection.family,
      fontPath: materializeFont(bytes, digest),
      bold: kind === "font-bold",
    })
    if (verification) return verification

    await saveTemplateAsset({
      templateId: id,
      kind: kind as "font-regular" | "font-bold",
      contentType: file.type || "font/ttf",
      bytes,
      sha256: digest,
      fontFamily: inspection.family,
      originalFilename: file.name,
    })

    return NextResponse.json({ kind, fontFamily: inspection.family })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * Zwraca gotową odmowę albo null, gdy render weryfikacyjny przeszedł.
 * Rozróżnia winę pliku od wady środowiska: gdy sharp ignoruje `fontfile`
 * w ogóle (brak fontconfig — LUKA 5), żaden wgrany font nie ma szans, a
 * użytkownik musi dostać komunikat, który wskazuje na środowisko, nie na plik.
 */
async function verifyUploadedFont(input: FontVerificationInput): Promise<NextResponse | null> {
  try {
    await verifyFontRendering(input)
    return null
  } catch (error) {
    if (!(error instanceof FontVerificationError)) throw error

    // Podmiana komunikatu TYLKO dla odmowy z atrybucji: uszkodzony plik jest
    // uszkodzony niezależnie od środowiska i zwalanie tego na fontconfig
    // wysłałoby użytkownika w złą stronę.
    const blameEnvironment =
      error.code === "font-not-applied" && !(await supportsFontFiles())
    const message = blameEnvironment
      ? "Środowisko renderujące ignoruje własne pliki fontów — nawet font z biblioteki " +
        "nie jest w nim stosowany, więc szablon składałby się fontem zastępczym. " +
        "Sprawdź pakiet fontconfig w obrazie aplikacji."
      : error.message

    console.error("[ilustromat] render weryfikacyjny odrzucił font:", error.code, error.message)
    return NextResponse.json({ error: error.code, message }, { status: 400 })
  }
}
