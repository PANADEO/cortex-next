// Logika modułu Ilustromat (code-service) — szablony marki i ich assety.
// Kontrolery w app/idp/app/api/ilustromat/** tylko walidują wejście i wołają to.
// Zero surowego SQL poza tym plikiem — dostęp przez Drizzle.
//
// Kształt 1:1 z modułem system-config: schemat własny, wejście walidowane
// Zodem, błędy domenowe jako klasy (kontroler mapuje je na kody HTTP).
//
// Renderowanie, fonty i prompty NIE są tutaj — żyją w app/idp/lib/ilustromat/,
// bo są specyficzne dla jednego kafelka i ciągną sharp/fontkit. Tu zostaje to,
// co dotyka bazy.

import {
  frameTemplates,
  getDb,
  templateAssets,
  type FrameTemplateRow,
  type TemplateAssetRow,
} from "@cortex/db"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

export const ILUSTROMAT_APP_CODE = "ilustromat"

/** Kod scope'u warstwy granularnej — kto może zarządzać szablonami marki.
 *  Wiersz w application_scopes musi mieć dokładnie ten kod. */
export const MANAGE_TEMPLATES_SCOPE = "manage-templates"

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/** Te same granice co check constraints w bazie — walidacja tutaj daje
 *  czytelny błąd 400 zamiast błędu Postgresa. */
export const frameTemplateInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    colorBg: z.string().regex(HEX_COLOR, "Kolor musi być w formacie #RRGGBB"),
    colorText: z.string().regex(HEX_COLOR, "Kolor musi być w formacie #RRGGBB"),
    colorAccent: z.string().regex(HEX_COLOR, "Kolor musi być w formacie #RRGGBB"),
    fontSource: z.enum(["library", "custom"]),
    fontLibraryId: z.string().max(64).nullish(),
    logoPosition: z.enum(["bottom-left", "bottom-right"]),
    cornerRadius: z.number().int().min(0).max(48),
    minImageAreaRatio: z.number().min(0.35).max(0.6),
    websiteText: z.string().max(120).nullish(),
    layout: z.enum(["image-top", "image-bottom"]),
    textAlign: z.enum(["left", "center"]),
    isActive: z.boolean().optional(),
  })
  .refine((value) => (value.fontSource === "library" ? Boolean(value.fontLibraryId) : true), {
    message: "Szablon na foncie z biblioteki musi wskazać font",
    path: ["fontLibraryId"],
  })
  .refine((value) => (value.fontSource === "custom" ? !value.fontLibraryId : true), {
    message: "Szablon na własnym foncie nie wskazuje fontu z biblioteki",
    path: ["fontLibraryId"],
  })

export type FrameTemplateInput = z.infer<typeof frameTemplateInputSchema>

export class UnknownTemplateError extends Error {
  /** Identyfikator szablonu — pole STRUKTURALNE dla kontrolera, który buduje
   *  z niego `messageParams`; `message` zostaje diagnostyką do logu. */
  readonly templateId: string

  constructor(templateId: string) {
    super(`Nie ma szablonu o id ${templateId}`)
    this.name = "UnknownTemplateError"
    this.templateId = templateId
  }
}

export class MissingTemplateAssetError extends Error {
  constructor(templateId: string, kind: string) {
    super(`Szablon ${templateId} nie ma wymaganego assetu: ${kind}`)
    this.name = "MissingTemplateAssetError"
  }
}

/** Slug + 6 znaków hex — port generate_template_id() z core/templates.py. */
export function generateTemplateId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "szablon"
  const suffix = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")
  return `${slug}-${suffix}`
}

export async function listFrameTemplates(activeOnly = false): Promise<FrameTemplateRow[]> {
  const db = getDb()
  const query = db.select().from(frameTemplates).orderBy(asc(frameTemplates.name))
  const rows = await query
  return activeOnly ? rows.filter((row) => row.isActive) : rows
}

export async function getFrameTemplate(id: string): Promise<FrameTemplateRow | null> {
  const [row] = await getDb().select().from(frameTemplates).where(eq(frameTemplates.id, id))
  return row ?? null
}

export async function createFrameTemplate(
  input: FrameTemplateInput,
  createdBy: string,
): Promise<FrameTemplateRow> {
  const [created] = await getDb()
    .insert(frameTemplates)
    .values({ ...toTemplateValues(input), id: generateTemplateId(input.name), createdBy })
    .returning()

  return created as FrameTemplateRow
}

export async function updateFrameTemplate(
  id: string,
  input: FrameTemplateInput,
): Promise<FrameTemplateRow> {
  const [updated] = await getDb()
    .update(frameTemplates)
    .set({ ...toTemplateValues(input), updatedAt: new Date() })
    .where(eq(frameTemplates.id, id))
    .returning()

  if (!updated) throw new UnknownTemplateError(id)
  return updated
}

export async function setFrameTemplateActive(
  id: string,
  isActive: boolean,
): Promise<FrameTemplateRow> {
  const [updated] = await getDb()
    .update(frameTemplates)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(frameTemplates.id, id))
    .returning()

  if (!updated) throw new UnknownTemplateError(id)
  return updated
}

export async function deleteFrameTemplate(id: string): Promise<boolean> {
  // template_assets ma FK z ON DELETE CASCADE — assety znikają razem z szablonem.
  const deleted = await getDb().delete(frameTemplates).where(eq(frameTemplates.id, id)).returning()
  return deleted.length > 0
}

/**
 * Kopiuje szablon RAZEM z assetami pod nowym id — najtańsza droga do wariantu
 * istniejącego bez wgrywania fontu/logo od zera (PoC ma tylko duplikuj, nie
 * edycję in-place; ta granica zostaje).
 *
 * W transakcji, w przeciwieństwie do PoC: tam `shutil.copytree` szło OBOK
 * zapisu JSON, więc przerwanie w połowie zostawiało szablon bez plików albo
 * pliki bez szablonu.
 */
export async function duplicateFrameTemplate(
  id: string,
  createdBy: string,
): Promise<FrameTemplateRow> {
  const db = getDb()

  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(frameTemplates).where(eq(frameTemplates.id, id))
    if (!source) throw new UnknownTemplateError(id)

    const newId = generateTemplateId(source.name)
    const [copy] = await tx
      .insert(frameTemplates)
      .values({
        ...source,
        id: newId,
        name: `${source.name} (kopia)`,
        isActive: true,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    const assets = await tx.select().from(templateAssets).where(eq(templateAssets.templateId, id))
    if (assets.length > 0) {
      await tx.insert(templateAssets).values(
        assets.map((asset) => ({
          templateId: newId,
          kind: asset.kind,
          contentType: asset.contentType,
          bytes: asset.bytes,
          sha256: asset.sha256,
          fontFamily: asset.fontFamily,
          originalFilename: asset.originalFilename,
        })),
      )
    }

    return copy as FrameTemplateRow
  })
}

export interface TemplateAssetInput {
  templateId: string
  kind: "font-regular" | "font-bold" | "logo"
  contentType: string
  bytes: Buffer
  sha256: string
  fontFamily?: string | null
  originalFilename?: string | null
}

/** Zapis assetu jest idempotentny per (szablon, rodzaj) — ponowne wgranie
 *  fontu podmienia poprzedni, zamiast tworzyć drugi wiersz tego samego rodzaju. */
export async function saveTemplateAsset(input: TemplateAssetInput): Promise<void> {
  await getDb()
    .insert(templateAssets)
    .values({
      templateId: input.templateId,
      kind: input.kind,
      contentType: input.contentType,
      bytes: input.bytes,
      sha256: input.sha256,
      fontFamily: input.fontFamily ?? null,
      originalFilename: input.originalFilename ?? null,
    })
    .onConflictDoUpdate({
      target: [templateAssets.templateId, templateAssets.kind],
      set: {
        contentType: input.contentType,
        bytes: input.bytes,
        sha256: input.sha256,
        fontFamily: input.fontFamily ?? null,
        originalFilename: input.originalFilename ?? null,
      },
    })
}

export async function listTemplateAssets(templateId: string): Promise<TemplateAssetRow[]> {
  return getDb().select().from(templateAssets).where(eq(templateAssets.templateId, templateId))
}

export async function getTemplateAsset(
  templateId: string,
  kind: TemplateAssetInput["kind"],
): Promise<TemplateAssetRow | null> {
  const [row] = await getDb()
    .select()
    .from(templateAssets)
    .where(and(eq(templateAssets.templateId, templateId), eq(templateAssets.kind, kind)))
  return row ?? null
}

function toTemplateValues(input: FrameTemplateInput) {
  const usesLibrary = input.fontSource === "library"
  return {
    name: input.name,
    colorBg: input.colorBg.toUpperCase(),
    colorText: input.colorText.toUpperCase(),
    colorAccent: input.colorAccent.toUpperCase(),
    fontSource: input.fontSource,
    fontLibraryId: usesLibrary ? (input.fontLibraryId ?? null) : null,
    logoPosition: input.logoPosition,
    cornerRadius: input.cornerRadius,
    minImageAreaRatio: input.minImageAreaRatio,
    websiteText: input.websiteText ?? null,
    layout: input.layout,
    textAlign: input.textAlign,
    isActive: input.isActive ?? true,
  }
}
