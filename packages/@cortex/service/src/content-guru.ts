// Logika modułu Content Guru (code-service) — CRUD `content_archive` i
// `forbidden_phrases`, dwie z czterech per-user tabel ze schematu Faza 0
// (packages/@cortex/db/src/schema/content-guru.ts). Kontrolery w
// app/idp/app/api/content-guru/** (code-api) tylko walidują wejście i wołają
// to. Zero surowego SQL poza tym plikiem — dostęp przez Drizzle.
//
// PROJECT/cortex-frontend-content-guru-full-port-projekt.md D10 + Faza
// 1+2 tej rundy: wzorzec .claude/skills/code-service/SKILL.md "Rekordy
// per-user (userEmail)" cytowany dosłownie, nie reinterpretowany —
//  1. `userEmail` to filtr WIDOCZNOŚCI wpisany w .where() KAŻDEGO zapytania,
//     nigdy fetch-wszystko-i-filtruj-w-JS.
//  2. `getMyArchiveEntry`/`removeForbiddenPhrase` zwracają `undefined`/`false`
//     zarówno dla "nie istnieje", jak i "cudze" — wołający (route) mapuje
//     oba na 404, NIGDY 403 (403 zdradzałby, że rekord o tym id w ogóle
//     istnieje).
//  3. `userEmail` to obowiązkowy, pierwszy parametr pozycyjny, pochodzący
//     WYŁĄCZNIE z access.email uwierzytelnionego przez requireTileAccess() —
//     nigdy z ciała/query żądania.
//
// `templates`/`client_profiles`/`market_profiles` (pozostałe trzy tabele
// schematu) są POZA zakresem tej rundy — CRUD szablonów i profili to Round B/C
// (design doc §8, Fazy 3-4). Te dwie tabele tutaj są w zakresie, bo zakazane
// frazy zasilają walidację generowania (forbidden-phrase-check.ts) już w tej
// rundzie, mimo że ich WŁASNY ekran zarządzania (/content-guru/forbidden-
// phrases) jest Round B — stąd CRUD istnieje, ale tylko GET/POST/DELETE, bez
// PUT/edycji in-place (design doc §4.4: "usuń+dodaj-ponownie jest tańsze niż
// edytor" dla krótkich fraz).

import {
  contentArchive,
  forbiddenPhrases,
  getDb,
  type ContentArchiveRow,
  type ContentArchiveStatus,
  type ForbiddenPhraseRow,
} from "@cortex/db"
import { and, desc, eq } from "drizzle-orm"

// ---- content_archive ----

/** Filtr jest częścią zapytania, nie osobnym krokiem możliwym do pominięcia.
 *  Bez page/sort/search — CortexDataGrid (Round E, ekran /content-guru/history)
 *  filtruje/sortuje/paginuje po stronie przeglądarki nad całą (już
 *  przefiltrowaną do usera) tablicą, wzorem listMyCalculations()
 *  (code-service/SKILL.md pkt 4). Nieużywana przez żaden route w tej rundzie
 *  (generowanie tylko ZAPISUJE do archiwum) — dodana teraz, bo Round E ma ją
 *  po prostu zaimportować, nie odkrywać na nowo. */
export function listMyArchive(userEmail: string): Promise<ContentArchiveRow[]> {
  return getDb()
    .select()
    .from(contentArchive)
    .where(eq(contentArchive.userEmail, userEmail))
    .orderBy(desc(contentArchive.createdAt))
}

/** Szczegóły JEDNEGO wpisu archiwum. Właścicielstwo w WHERE, nie sprawdzane
 *  po fetchu. Nieużywana przez żaden route w tej rundzie (brak jeszcze
 *  /content-guru/history/[id], Round E) — jak wyżej, gotowa pod Round E. */
export async function getMyArchiveEntry(
  userEmail: string,
  id: string,
): Promise<ContentArchiveRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(contentArchive)
    .where(and(eq(contentArchive.id, id), eq(contentArchive.userEmail, userEmail)))
  return row
}

export interface SaveArchiveEntryInput {
  contentType: string
  topic: string | null
  generatedContent: string
  status: ContentArchiveStatus
  /** Puste [] zapisywane jako `null` w kolumnie — spójne z "brak trafień", nie
   *  z pustym, ale "sprawdzonym" wynikiem (kolumna jest nullable właśnie po to). */
  matchedForbiddenPhrases: readonly string[]
  targetAudience: string | null
  additionalInfo: string | null
  keywordPhrase: string | null
  metaDescription: string | null
  modelUsed: string
  clientProfileId?: string | null
  marketProfileId?: string | null
  /** generation_mode/batch_position/batch_total itd. — bez sztywnych kolumn,
   *  wzorem geo-score-calculator.calculations.result (design doc §5). */
  metadata?: Record<string, unknown>
}

/** KAŻDE wywołanie "Generuj" auto-loguje się tutaj (design doc §1.4, D5) —
 *  nie ma osobnego "zapisz do archiwum". Treść jest ZAWSZE zapisywana, nawet
 *  gdy `status` to `"done-with-warnings"` — nigdy nie wyrzucamy płatnego
 *  wywołania LLM po cichu (decyzja Alexa 03.08.2026, design doc §9 p.2). */
export async function saveArchiveEntry(
  userEmail: string,
  input: SaveArchiveEntryInput,
): Promise<ContentArchiveRow> {
  const [row] = await getDb()
    .insert(contentArchive)
    .values({
      userEmail,
      contentType: input.contentType,
      topic: input.topic,
      generatedContent: input.generatedContent,
      status: input.status,
      matchedForbiddenPhrases:
        input.matchedForbiddenPhrases.length > 0 ? [...input.matchedForbiddenPhrases] : null,
      targetAudience: input.targetAudience,
      additionalInfo: input.additionalInfo,
      keywordPhrase: input.keywordPhrase,
      metaDescription: input.metaDescription,
      modelUsed: input.modelUsed,
      clientProfileId: input.clientProfileId ?? null,
      marketProfileId: input.marketProfileId ?? null,
      metadata: input.metadata ?? {},
    })
    .returning()

  if (!row) throw new Error("Nie udało się zapisać wpisu w archiwum Content Guru")
  return row
}

// ---- forbidden_phrases ----

/** Lista zakazanych fraz usera, w kolejności dodania (najnowsze pierwsze) —
 *  konsumowana DWA razy w tej rundzie: przez route generowania (Warstwa 1+2
 *  z D5) i, w przyszłości, przez ekran zarządzania (Round B). */
export function listMyForbiddenPhrases(userEmail: string): Promise<ForbiddenPhraseRow[]> {
  return getDb()
    .select()
    .from(forbiddenPhrases)
    .where(eq(forbiddenPhrases.userEmail, userEmail))
    .orderBy(desc(forbiddenPhrases.createdAt))
}

export interface AddForbiddenPhraseInput {
  phrase: string
  description?: string | null
}

export async function addForbiddenPhrase(
  userEmail: string,
  input: AddForbiddenPhraseInput,
): Promise<ForbiddenPhraseRow> {
  const [row] = await getDb()
    .insert(forbiddenPhrases)
    .values({ userEmail, phrase: input.phrase, description: input.description ?? null })
    .returning()

  if (!row) throw new Error("Nie udało się dodać zakazanej frazy")
  return row
}

/** `boolean`, nie rekord — usunięcie cudzej frazy (id istnieje, ale
 *  userEmail się nie zgadza) zwraca `false`, wołający mapuje na 404, nigdy 403
 *  (pkt 2 wyżej). */
export async function removeForbiddenPhrase(userEmail: string, id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(forbiddenPhrases)
    .where(and(eq(forbiddenPhrases.id, id), eq(forbiddenPhrases.userEmail, userEmail)))
    .returning()
  return deleted.length > 0
}
