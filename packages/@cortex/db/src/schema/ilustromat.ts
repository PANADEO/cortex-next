// Schemat modułu Ilustromat — port core/templates.py z PoC (~/REPO/ilustromat).
// Jedna baza Postgres, schema-per-moduł (docs/database.md, code-db).
//
// Dwie tabele: szablon marki (FrameTemplate 1:1 z PoC) + jego assety (font/logo)
// jako bytea. W PoC assety leżały na dysku obok pliku JSON — dwie operacje,
// które mogły się rozjechać (duplicate_template robił shutil.copytree OBOK
// zapisu JSON). Tutaj wiersz i jego pliki żyją w jednej transakcji.
//
// Czego tu świadomie NIE MA: tabel generations/generation_variants. Historia
// generacji nie jest utrwalana w MVP (parytet z PoC) — tła żyją w sesji
// przeglądarki i wracają w ciele żądania rekompozycji. Patrz sekcja 3.2
// projektu w Obsidianie.

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  customType,
  doublePrecision,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

export const ilustromat = pgSchema("ilustromat")

/** Dozwolone wartości kolumn wyliczeniowych. Te same literały co typy
 *  Literal w core/templates.py — pilnowane też check constraintami niżej,
 *  nie tylko Zodem w warstwie serwisowej. */
export const FONT_SOURCES = ["library", "custom"] as const
export const LOGO_POSITIONS = ["bottom-left", "bottom-right"] as const
export const FRAME_LAYOUTS = ["image-top", "image-bottom"] as const
export const TEXT_ALIGNS = ["left", "center"] as const
export const TEMPLATE_ASSET_KINDS = ["font-regular", "font-bold", "logo"] as const

export type FontSource = (typeof FONT_SOURCES)[number]
export type LogoPosition = (typeof LOGO_POSITIONS)[number]
export type FrameLayout = (typeof FRAME_LAYOUTS)[number]
export type TextAlign = (typeof TEXT_ALIGNS)[number]
export type TemplateAssetKind = (typeof TEMPLATE_ASSET_KINDS)[number]

/** Drizzle 0.36 nie ma wbudowanego bytea — własny typ kolumny mapujący
 *  Buffer <-> bytea. Bez tego assety musiałyby iść base64 w tekście. */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
})

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()

/**
 * Szablon marki. Kolory jako hex ("#5B3DA8"), nie trójka RGB — tego chce
 * formularz w UI i to samo czyta markup Pango w composerze; konwersja na
 * kanały dzieje się w jednym miejscu (lib/ilustromat/color.ts).
 */
export const frameTemplates = ilustromat.table(
  "frame_templates",
  {
    // Slug + 6 znaków hex, jak generate_template_id() w PoC — czytelne id
    // w URL-u kreatora, bez zgadywania kolejnego numeru.
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    colorBg: text("color_bg").notNull(),
    colorText: text("color_text").notNull(),
    colorAccent: text("color_accent").notNull(),
    fontSource: text("font_source").notNull().default("library"),
    fontLibraryId: text("font_library_id"),
    logoPosition: text("logo_position").notNull().default("bottom-right"),
    cornerRadius: integer("corner_radius").notNull().default(28),
    minImageAreaRatio: doublePrecision("min_image_area_ratio").notNull().default(0.45),
    websiteText: text("website_text"),
    layout: text("layout").notNull().default("image-top"),
    textAlign: text("text_align").notNull().default("left"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull().default("system"),
    createdAt,
    updatedAt,
  },
  (table) => ({
    fontSourceAllowed: check(
      "frame_templates_font_source_allowed",
      sql`${table.fontSource} in ('library', 'custom')`,
    ),
    logoPositionAllowed: check(
      "frame_templates_logo_position_allowed",
      sql`${table.logoPosition} in ('bottom-left', 'bottom-right')`,
    ),
    layoutAllowed: check(
      "frame_templates_layout_allowed",
      sql`${table.layout} in ('image-top', 'image-bottom')`,
    ),
    textAlignAllowed: check(
      "frame_templates_text_align_allowed",
      sql`${table.textAlign} in ('left', 'center')`,
    ),
    // Zakresy geometrii z core/presets.py (CORNER_RADIUS_RANGE,
    // MIN_IMAGE_AREA_RATIO_RANGE) — layout ma się nie dać połamać wpisem
    // z pominięciem UI.
    cornerRadiusRange: check(
      "frame_templates_corner_radius_range",
      sql`${table.cornerRadius} between 0 and 48`,
    ),
    minImageAreaRatioRange: check(
      "frame_templates_min_image_area_ratio_range",
      sql`${table.minImageAreaRatio} between 0.35 and 0.60`,
    ),
    // Kolory zawsze jako #RRGGBB — composer parsuje je bez wariantów.
    colorsHex: check(
      "frame_templates_colors_hex",
      sql`${table.colorBg} ~ '^#[0-9A-Fa-f]{6}$'
          and ${table.colorText} ~ '^#[0-9A-Fa-f]{6}$'
          and ${table.colorAccent} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    // Szablon na foncie z biblioteki MUSI wskazać który; szablon na własnym
    // foncie nie wskazuje żadnego (pliki ma w template_assets).
    fontSourceShape: check(
      "frame_templates_font_source_shape",
      sql`(${table.fontSource} = 'library' and ${table.fontLibraryId} is not null)
          or (${table.fontSource} = 'custom' and ${table.fontLibraryId} is null)`,
    ),
  }),
)

/**
 * Pliki szablonu (własny font regular/bold, logo) trzymane w bazie.
 * `sha256` jest kluczem cache'a materializacji fontu na dysk — sharp przyjmuje
 * `fontfile` wyłącznie jako ścieżkę, nie bufor (Luka 1 projektu).
 * `fontFamily` to nazwa rodziny odczytana z pliku fontkitem: opis Pango musi
 * ją podać dosłownie, inaczej Pango po cichu dobierze inny font (Luka 3).
 */
export const templateAssets = ilustromat.table(
  "template_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: text("template_id")
      .notNull()
      .references(() => frameTemplates.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    contentType: text("content_type").notNull(),
    bytes: bytea("bytes").notNull(),
    sha256: text("sha256").notNull(),
    fontFamily: text("font_family"),
    originalFilename: text("original_filename"),
    createdAt,
  },
  (table) => ({
    kindAllowed: check(
      "template_assets_kind_allowed",
      sql`${table.kind} in ('font-regular', 'font-bold', 'logo')`,
    ),
    oneAssetPerKind: unique("template_assets_template_kind_unique").on(
      table.templateId,
      table.kind,
    ),
  }),
)

export type FrameTemplateRow = typeof frameTemplates.$inferSelect
export type FrameTemplateInsert = typeof frameTemplates.$inferInsert
export type TemplateAssetRow = typeof templateAssets.$inferSelect
