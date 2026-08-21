// Most między warstwą danych (wiersze Drizzle) a czystym composerem.
//
// Composer.ts z założenia NIE zna bazy — bierze bufory i FrameTemplate. Ten
// plik jest jedynym miejscem, które wie, skąd te bufory wziąć: font z
// biblioteki (plik na dysku) albo własny font szablonu (bytea -> materializacja
// do tmpdir), plus opcjonalne logo.

import type { FrameTemplateRow } from "@cortex/db"
import { getFrameTemplate, getTemplateAsset, type FrameTemplateInput } from "@cortex/service"
import type { ComposeFonts } from "./composer"
import { materializeFont } from "./font-cache"
import { resolveFontLibraryEntry } from "./font-library"
import type { FrameTemplate } from "./types"

export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Nie ma szablonu o id ${templateId}`)
    this.name = "TemplateNotFoundError"
  }
}

export class IncompleteCustomFontError extends Error {
  constructor(templateId: string, kind: string) {
    super(
      `Szablon ${templateId} deklaruje własny font, ale brakuje pliku "${kind}". ` +
        `Render przerwany — Ilustromat nie podmienia brakującego fontu po cichu.`,
    )
    this.name = "IncompleteCustomFontError"
  }
}

/** Wiersz bazy -> kształt domenowy, którego oczekuje composer. */
export function toFrameTemplate(row: FrameTemplateRow): FrameTemplate {
  return {
    id: row.id,
    name: row.name,
    colorBg: row.colorBg,
    colorText: row.colorText,
    colorAccent: row.colorAccent,
    fontSource: row.fontSource as FrameTemplate["fontSource"],
    fontLibraryId: row.fontLibraryId,
    logoPosition: row.logoPosition as FrameTemplate["logoPosition"],
    cornerRadius: row.cornerRadius,
    minImageAreaRatio: row.minImageAreaRatio,
    websiteText: row.websiteText,
    layout: row.layout as FrameTemplate["layout"],
    textAlign: row.textAlign as FrameTemplate["textAlign"],
    isActive: row.isActive,
    createdBy: row.createdBy,
  }
}

/** Nieutrwalony szablon z kreatora (live preview) — ten sam kształt, bez id. */
export function draftToFrameTemplate(input: FrameTemplateInput, id = "podglad"): FrameTemplate {
  return {
    id,
    name: input.name,
    colorBg: input.colorBg,
    colorText: input.colorText,
    colorAccent: input.colorAccent,
    fontSource: input.fontSource,
    fontLibraryId: input.fontLibraryId ?? null,
    logoPosition: input.logoPosition,
    cornerRadius: input.cornerRadius,
    minImageAreaRatio: input.minImageAreaRatio,
    websiteText: input.websiteText ?? null,
    layout: input.layout,
    textAlign: input.textAlign,
    isActive: input.isActive ?? true,
    createdBy: "podglad",
  }
}

export interface ResolvedRender {
  template: FrameTemplate
  fonts: ComposeFonts
  logo: Buffer | null
}

/**
 * Fonty szablonu gotowe dla sharpa. Dla `font_source = "custom"` materializuje
 * bajty z bazy na dysk (sharp przyjmuje `fontfile` wyłącznie jako ścieżkę)
 * i bierze nazwę rodziny ZAPISANĄ przy wgrywaniu — nie zgaduje jej, bo rozjazd
 * nazwy sprawia, że Pango po cichu dobiera inny krój.
 */
export async function resolveTemplateFonts(template: FrameTemplate): Promise<ComposeFonts> {
  if (template.fontSource === "library") {
    const entry = resolveFontLibraryEntry(template.fontLibraryId)
    return { family: entry.family, regularPath: entry.regularPath, boldPath: entry.boldPath }
  }

  const [regular, bold] = await Promise.all([
    getTemplateAsset(template.id, "font-regular"),
    getTemplateAsset(template.id, "font-bold"),
  ])
  if (!regular) throw new IncompleteCustomFontError(template.id, "font-regular")
  if (!bold) throw new IncompleteCustomFontError(template.id, "font-bold")

  return {
    family: regular.fontFamily ?? bold.fontFamily ?? "",
    regularPath: materializeFont(regular.bytes, regular.sha256),
    boldPath: materializeFont(bold.bytes, bold.sha256),
  }
}

export async function resolveTemplateRender(templateId: string): Promise<ResolvedRender> {
  const row = await getFrameTemplate(templateId)
  if (!row) throw new TemplateNotFoundError(templateId)

  const template = toFrameTemplate(row)
  const [fonts, logoAsset] = await Promise.all([
    resolveTemplateFonts(template),
    getTemplateAsset(templateId, "logo"),
  ])

  return { template, fonts, logo: logoAsset?.bytes ?? null }
}
