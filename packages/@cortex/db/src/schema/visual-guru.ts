// Schemat modułu Visual Guru — PROJECT/cortex-frontend-visual-guru-tile-projekt.md
// sekcja 5. Dwie tabele: `generations` (metadane + właściciel per-user) i
// `generation_variants` (obrazy WYNIKOWE jako bytea, wzorem
// ilustromat.template_assets — D6).
//
// D5 (transient reference image): obraz referencyjny wgrywany przez usera
// NIGDY nie trafia do Postgresa — żyje wyłącznie w treści żądania do
// cortex-proxy. Tu zostaje tylko ślad (`hadReferenceImage`/
// `referenceImageFileName`), nie same bajty.
//
// Faza 0 (fundament): tylko schemat + migracja. Logika serwisowa
// (listMyGenerations/getMyGeneration/createGeneration) żyje w
// @cortex/service/src/visual-guru.ts (code-service, "Rekordy per-user").
// Generator/archiwum UI i API routes to Faza 1/2 — poza zakresem tej zmiany.

import { boolean, customType, index, integer, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const visualGuru = pgSchema("visual_guru")

/** Wzorem ilustromat.template_assets — bytea dla WYNIKÓW, nie wejścia (D5/D6).
 *  Drizzle 0.36 nie ma wbudowanego bytea — własny typ kolumny mapujący
 *  Buffer <-> bytea. */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
})

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

/**
 * Jedna generacja = jedno kliknięcie "Generuj" (prompt + opcjonalny obraz
 * referencyjny + N wariantów wynikowych). Auto-logowana przy każdym
 * wywołaniu (wzorem GEO Score Calculator) — nie ma osobnego "zapisz".
 */
export const generations = visualGuru.table(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Właściciel rekordu — filtr WIDOCZNOŚCI (code-service "Rekordy
    // per-user" pkt 1), nie ślad audytowy.
    userEmail: text("user_email").notNull(),
    prompt: text("prompt").notNull(),
    additionalContext: text("additional_context"),
    // Ślad, NIE bajty (D5) — obraz referencyjny nigdy nie trafia do Postgresa.
    hadReferenceImage: boolean("had_reference_image").notNull().default(false),
    referenceImageFileName: text("reference_image_file_name"),
    model: text("model").notNull(),
    variantCount: integer("variant_count").notNull(),
    createdAt,
  },
  (table) => ({
    // Każde zapytanie tego modułu filtruje po userEmail i sortuje po
    // createdAt — dokładnie ta para kolumn, dokładnie w tej kolejności
    // (code-service/SKILL.md "Rekordy per-user", przykład referencyjny).
    byUserCreatedAt: index("generations_user_email_created_at_idx").on(
      table.userEmail,
      table.createdAt,
    ),
  }),
)

/** Wynikowe obrazy — właściwy produkt archiwum, stąd bytea (wzorem
 *  template_assets). Brak retencji/TTL w v1 — decyzja Alexa (03.08.2026,
 *  design doc sekcja 10 pkt 3), świadomy dług do obserwacji, nie przeoczenie. */
export const generationVariants = visualGuru.table(
  "generation_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    variantIndex: integer("variant_index").notNull(),
    image: bytea("image").notNull(),
    contentType: text("content_type").notNull().default("image/png"),
  },
  (table) => ({
    oneVariantPerIndex: unique("generation_variants_generation_index_unique").on(
      table.generationId,
      table.variantIndex,
    ),
  }),
)

export type GenerationRow = typeof generations.$inferSelect
export type GenerationInsert = typeof generations.$inferInsert
export type GenerationVariantRow = typeof generationVariants.$inferSelect
export type GenerationVariantInsert = typeof generationVariants.$inferInsert
