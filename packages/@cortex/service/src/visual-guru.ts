// Logika modułu Visual Guru (code-service) — archiwum generacji obrazów,
// rekordy per-user. Kontrolery w app/idp/app/api/visual-guru/** (Faza 1+,
// POZA ZAKRESEM tej zmiany — Faza 0 dodaje wyłącznie tę warstwę serwisową +
// schemat/migrację) mają tylko walidować wejście i wołać to. Zero surowego
// SQL poza tym plikiem.
//
// Wzorzec DOKŁADNIE wg .claude/skills/code-service/SKILL.md, "Rekordy
// per-user (userEmail)" — cytowany, nie reimplementowany od zera:
//  1. `userEmail` to filtr WIDOCZNOŚCI wpisany w .where() KAŻDEGO zapytania,
//     nigdy fetch-wszystko-i-filtruj-w-JS.
//  2. `getMyGeneration` zwraca `undefined` zarówno dla "nie istnieje", jak i
//     "cudze" — wołający (route, Faza 1) mapuje oba na 404, NIGDY 403.
//  3. `userEmail` to obowiązkowy, pierwszy parametr pozycyjny, pochodzący
//     WYŁĄCZNIE z access.email uwierzytelnionego przez requireTileAccess() —
//     nigdy z ciała/query żądania.
//
// D5 (design doc): obraz referencyjny NIGDY nie trafia tutaj — funkcje w tym
// pliku przyjmują wyłącznie ślad (hadReferenceImage/referenceImageFileName),
// nie same bajty. D6: generation_variants.image (bytea) to WYNIK, wzorem
// ilustromat.template_assets.bytes.

import {
  generationVariants,
  generations,
  getDb,
  type GenerationRow,
  type GenerationVariantRow,
} from "@cortex/db"
import { and, desc, eq } from "drizzle-orm"

export const VISUAL_GURU_APP_CODE = "visual-guru"

export interface GenerationVariantInput {
  variantIndex: number
  image: Buffer
  contentType?: string
}

export interface CreateGenerationInput {
  prompt: string
  additionalContext?: string | null
  hadReferenceImage: boolean
  referenceImageFileName?: string | null
  model: string
  variants: GenerationVariantInput[]
}

export interface GenerationWithVariants extends GenerationRow {
  variants: GenerationVariantRow[]
}

/** Filtr jest częścią zapytania, nie osobnym krokiem możliwym do pominięcia.
 *  Bez page/sort/search — CortexDataGrid filtruje/sortuje/paginuje po stronie
 *  przeglądarki nad całą (już przefiltrowaną do usera) tablicą, wzorem
 *  listMyCalculations() (code-service/SKILL.md pkt 4). */
export function listMyGenerations(userEmail: string): Promise<GenerationRow[]> {
  return getDb()
    .select()
    .from(generations)
    .where(eq(generations.userEmail, userEmail))
    .orderBy(desc(generations.createdAt))
}

/** Szczegóły JEDNEJ generacji + jej warianty. Właścicielstwo w WHERE, nie
 *  sprawdzane po fetchu. `undefined` zarówno dla "nie istnieje", jak i
 *  "cudze" — route (Faza 1) mapuje oba na 404, NIGDY 403 (403 zdradzałby, że
 *  rekord o tym id w ogóle istnieje). */
export async function getMyGeneration(
  userEmail: string,
  id: string,
): Promise<GenerationWithVariants | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userEmail, userEmail)))
  if (!row) return undefined

  const variants = await db
    .select()
    .from(generationVariants)
    .where(eq(generationVariants.generationId, id))
    .orderBy(generationVariants.variantIndex)

  return { ...row, variants }
}

/**
 * Wiersz `generations` + N wierszy `generation_variants` w JEDNEJ transakcji
 * (wzorem duplicateFrameTemplate() z ilustromat.ts) — przerwana odpowiedź nie
 * zostawia osieroconego rekordu bez wariantów. Każde wywołanie "Generuj"
 * (Faza 1) auto-loguje się tutaj — nie ma osobnego "zapisz do archiwum".
 */
export async function createGeneration(
  userEmail: string,
  input: CreateGenerationInput,
): Promise<GenerationWithVariants> {
  const db = getDb()

  return db.transaction(async (tx) => {
    const [generation] = await tx
      .insert(generations)
      .values({
        userEmail,
        prompt: input.prompt,
        additionalContext: input.additionalContext ?? null,
        hadReferenceImage: input.hadReferenceImage,
        referenceImageFileName: input.referenceImageFileName ?? null,
        model: input.model,
        variantCount: input.variants.length,
      })
      .returning()

    if (!generation) throw new Error("Nie udało się utworzyć generacji Visual Guru")

    const variants =
      input.variants.length > 0
        ? await tx
            .insert(generationVariants)
            .values(
              input.variants.map((variant) => ({
                generationId: generation.id,
                variantIndex: variant.variantIndex,
                image: variant.image,
                contentType: variant.contentType ?? "image/png",
              })),
            )
            .returning()
        : []

    return { ...generation, variants }
  })
}
