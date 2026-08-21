// Logika modułu Content Guru (code-service) — CRUD wszystkich pięciu tabel
// produktowych ze schematu Faza 0 (packages/@cortex/db/src/schema/
// content-guru.ts): `content_archive`/`forbidden_phrases` (Round A),
// `templates`/`client_profiles`/`market_profiles` (Round B). Kontrolery w
// app/idp/app/api/content-guru/** (code-api) tylko walidują wejście i wołają
// to. Zero surowego SQL poza tym plikiem — dostęp przez Drizzle.
//
// PROJECT/cortex-frontend-content-guru-full-port-projekt.md D10: wzorzec
// .claude/skills/code-service/SKILL.md "Rekordy per-user (userEmail)"
// cytowany dosłownie, nie reinterpretowany — dotyczy CZTERECH per-user tabel
// (`content_archive`/`forbidden_phrases`/`client_profiles`/`market_profiles`):
//  1. `userEmail` to filtr WIDOCZNOŚCI wpisany w .where() KAŻDEGO zapytania,
//     nigdy fetch-wszystko-i-filtruj-w-JS.
//  2. `getMyArchiveEntry`/`removeForbiddenPhrase`/`getMy{Client,Market}Profile`/
//     `updateMy{Client,Market}Profile`/`deleteMy{Client,Market}Profile` zwracają
//     `undefined`/`false` zarówno dla "nie istnieje", jak i "cudze" — wołający
//     (route) mapuje oba na 404, NIGDY 403 (403 zdradzałby, że rekord o tym id
//     w ogóle istnieje).
//  3. `userEmail` to obowiązkowy, pierwszy parametr pozycyjny, pochodzący
//     WYŁĄCZNIE z access.email uwierzytelnionego przez requireTileAccess() —
//     nigdy z ciała/query żądania.
//
// `templates` (D6) jest WSPÓLNYM zasobem, nie per-user — brak filtra
// userEmail, `createdBy` to tylko ślad audytowy (patrz komentarz przy sekcji
// "templates" niżej). Mutacje gated przez `manage-templates` scope W ROUTE,
// nie w tej warstwie (RBAC nie jest sprawą code-service — patrz guard.ts).
//
// `forbidden_phrases` CRUD zostaje bez PUT/edycji in-place (design doc §4.4:
// "usuń+dodaj-ponownie jest tańsze niż edytor" dla krótkich fraz) — bez
// zmian względem Round A, ekran zarządzania (/content-guru/forbidden-phrases)
// nadal poza zakresem (osobna runda).

import {
  clientProfiles,
  contentArchive,
  forbiddenPhrases,
  generationJobs,
  getDb,
  marketProfiles,
  templates,
  type ClientProfileRow,
  type ContentArchiveRow,
  type ContentArchiveStatus,
  type ForbiddenPhraseRow,
  type GenerationJobMode,
  type GenerationJobRow,
  type GenerationJobStatus,
  type MarketProfileRow,
  type TemplateRow,
} from "@cortex/db"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"

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

// ---- templates (Round B — design doc D6) ----
//
// WSPÓLNY zasób między wszystkimi userami kafelka — brak filtra userEmail,
// dokładnie jak `ilustromat.frameTemplates`. `createdBy` jest tylko śladem
// audytowym. Mutacje są gated w route'ach przez `manage-templates` scope
// (app/idp/app/api/content-guru/_lib/guard.ts), nie tutaj — warstwa serwisowa
// nie zna requestu/RBAC (code-service: to kontroler sprawdza bramkę).

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))

export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(20000),
})
export type TemplateInput = z.infer<typeof templateInputSchema>

/** Posortowane kategoria->nazwa — dokładnie kolejność, w jakiej ekran
 *  `/content-guru/templates` (CortexDataGrid) i `Select` kategoria->nazwa na
 *  ekranie generowania mają je renderować. */
export function listTemplates(): Promise<TemplateRow[]> {
  return getDb().select().from(templates).orderBy(asc(templates.category), asc(templates.name))
}

export async function getTemplate(id: string): Promise<TemplateRow | undefined> {
  const [row] = await getDb().select().from(templates).where(eq(templates.id, id))
  return row
}

export async function createTemplate(
  input: TemplateInput,
  createdBy: string,
): Promise<TemplateRow> {
  const [row] = await getDb()
    .insert(templates)
    .values({ ...input, createdBy })
    .returning()
  if (!row) throw new Error("Nie udało się utworzyć szablonu Content Guru")
  return row
}

/** `undefined` dla nieistniejącego id — wołający (route) mapuje na 404. */
export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<TemplateRow | undefined> {
  const [row] = await getDb()
    .update(templates)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .returning()
  return row
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const deleted = await getDb().delete(templates).where(eq(templates.id, id)).returning()
  return deleted.length > 0
}

/** Kopiuje treść+kategorię pod nową nazwą "(kopia)" — wzorem
 *  `duplicateFrameTemplate()` w ilustromat.ts. Może zderzyć się z
 *  `uniqueCategoryName` jeśli kopia już istnieje (np. duplikowana dwa razy) —
 *  to jest zamierzone: wołający (route) mapuje naruszenie unikalności na 409,
 *  user nadaje nowej kopii inną nazwę. `undefined` dla nieistniejącego
 *  źródłowego id. */
export async function duplicateTemplate(
  id: string,
  createdBy: string,
): Promise<TemplateRow | undefined> {
  const source = await getTemplate(id)
  if (!source) return undefined

  const [row] = await getDb()
    .insert(templates)
    .values({
      name: `${source.name} (kopia)`,
      category: source.category,
      content: source.content,
      createdBy,
    })
    .returning()
  return row
}

// ---- client_profiles (Round B — design doc D7) ----
//
// PER-USER — code-service "Rekordy per-user" cytowane dosłownie: userEmail
// pierwszy pozycyjny parametr, filtr w KAŻDYM .where(), undefined zarówno dla
// "nie istnieje" jak i "cudze" (route mapuje na 404, nigdy 403).

export const clientProfileInputSchema = z.object({
  profileName: z.string().trim().min(1).max(200),
  history: optionalText(10000),
  description: optionalText(10000),
  products: optionalText(10000),
  offer: optionalText(10000),
  useCases: optionalText(10000),
  experience: optionalText(10000),
})
export type ClientProfileInput = z.infer<typeof clientProfileInputSchema>

export function listMyClientProfiles(userEmail: string): Promise<ClientProfileRow[]> {
  return getDb()
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userEmail, userEmail))
    .orderBy(desc(clientProfiles.createdAt))
}

export async function getMyClientProfile(
  userEmail: string,
  id: string,
): Promise<ClientProfileRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(clientProfiles)
    .where(and(eq(clientProfiles.id, id), eq(clientProfiles.userEmail, userEmail)))
  return row
}

export async function createClientProfile(
  userEmail: string,
  input: ClientProfileInput,
): Promise<ClientProfileRow> {
  const [row] = await getDb()
    .insert(clientProfiles)
    .values({ ...input, userEmail })
    .returning()
  if (!row) throw new Error("Nie udało się utworzyć profilu klienta")
  return row
}

export async function updateMyClientProfile(
  userEmail: string,
  id: string,
  input: ClientProfileInput,
): Promise<ClientProfileRow | undefined> {
  const [row] = await getDb()
    .update(clientProfiles)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(clientProfiles.id, id), eq(clientProfiles.userEmail, userEmail)))
    .returning()
  return row
}

export async function deleteMyClientProfile(userEmail: string, id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(clientProfiles)
    .where(and(eq(clientProfiles.id, id), eq(clientProfiles.userEmail, userEmail)))
    .returning()
  return deleted.length > 0
}

// ---- market_profiles (Round B — design doc D7) ----
// Kształt równoległy do client_profiles powyżej.

export const marketProfileInputSchema = z.object({
  profileName: z.string().trim().min(1).max(200),
  description: optionalText(10000),
  sizeTrends: optionalText(10000),
  personas: optionalText(10000),
  problems: optionalText(10000),
  needs: optionalText(10000),
  plans: optionalText(10000),
})
export type MarketProfileInput = z.infer<typeof marketProfileInputSchema>

export function listMyMarketProfiles(userEmail: string): Promise<MarketProfileRow[]> {
  return getDb()
    .select()
    .from(marketProfiles)
    .where(eq(marketProfiles.userEmail, userEmail))
    .orderBy(desc(marketProfiles.createdAt))
}

export async function getMyMarketProfile(
  userEmail: string,
  id: string,
): Promise<MarketProfileRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(marketProfiles)
    .where(and(eq(marketProfiles.id, id), eq(marketProfiles.userEmail, userEmail)))
  return row
}

export async function createMarketProfile(
  userEmail: string,
  input: MarketProfileInput,
): Promise<MarketProfileRow> {
  const [row] = await getDb()
    .insert(marketProfiles)
    .values({ ...input, userEmail })
    .returning()
  if (!row) throw new Error("Nie udało się utworzyć profilu rynku")
  return row
}

export async function updateMyMarketProfile(
  userEmail: string,
  id: string,
  input: MarketProfileInput,
): Promise<MarketProfileRow | undefined> {
  const [row] = await getDb()
    .update(marketProfiles)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(marketProfiles.id, id), eq(marketProfiles.userEmail, userEmail)))
    .returning()
  return row
}

export async function deleteMyMarketProfile(userEmail: string, id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(marketProfiles)
    .where(and(eq(marketProfiles.id, id), eq(marketProfiles.userEmail, userEmail)))
    .returning()
  return deleted.length > 0
}

// ---- generation_jobs (Round C — design doc D4, batch/pakiet) ----
//
// PER-USER, wzorzec identyczny do reszty tego pliku. `items` (jsonb) NIE jest
// re-walidowany schematem Zod na tym poziomie (code-service nie duplikuje
// warstwy Zod z route'a) — kontroler (jobs/route.ts) buduje pozycje z już
// zweryfikowanych szablonów/tematów.

export const GENERATION_JOB_ITEM_STATUSES = [
  "pending",
  "running",
  "done",
  "done-with-warnings",
  "error",
] as const
export type GenerationJobItemStatus = (typeof GENERATION_JOB_ITEM_STATUSES)[number]

/** Jedna pozycja (temat × szablon) w `generation_jobs.items`. `content`/
 *  `archiveId`/`matchedForbiddenPhrases`/`errorMessage` są nieobecne dopóki
 *  pozycja nie osiągnie statusu końcowego — orkiestracja
 *  (lib/content-guru/run-batch-generation.ts) dopisuje je przez
 *  `updateGenerationJobItem()` w miarę kończenia się wywołań cortex-proxy. */
export interface GenerationJobItem {
  templateId: string
  templateLabel: string
  topic: string
  status: GenerationJobItemStatus
  content?: string
  archiveId?: string
  matchedForbiddenPhrases?: string[]
  errorMessage?: string
}

export interface CreateGenerationJobItemInput {
  templateId: string
  templateLabel: string
  topic: string
}

/** INSERT z WSZYSTKIMI pozycjami na starcie, status `"pending"` każda (D4
 *  krok 1) — job istnieje w Postgresie PRZED jakąkolwiek generacją, dokładnie
 *  jak `createQueuedJob()` w document-parser. Zwraca wiersz z wygenerowanym
 *  `id`, którego route potrzebuje NATYCHMIAST do odpowiedzi `202`. */
export async function createGenerationJob(
  userEmail: string,
  mode: GenerationJobMode,
  items: readonly CreateGenerationJobItemInput[],
): Promise<GenerationJobRow> {
  const initialItems: GenerationJobItem[] = items.map((item) => ({ ...item, status: "pending" }))
  const [row] = await getDb()
    .insert(generationJobs)
    .values({ userEmail, mode, items: initialItems })
    .returning()
  if (!row) throw new Error("Nie udało się utworzyć zadania generowania Content Guru")
  return row
}

/** `undefined` zarówno dla "nie istnieje" jak i "cudze" (code-service
 *  "Rekordy per-user" pkt 2) — wołający (GET /jobs/:id) mapuje na 404. */
export async function getMyGenerationJob(
  userEmail: string,
  id: string,
): Promise<GenerationJobRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, id), eq(generationJobs.userEmail, userEmail)))
  return row
}

/** Przełącza job z `"queued"` na `"running"` — wołane RAZ, na starcie
 *  orkiestracji, PRZED pierwszym itemem (D4 krok 3). */
export async function markGenerationJobRunning(userEmail: string, id: string): Promise<void> {
  await getDb()
    .update(generationJobs)
    .set({ status: "running" })
    .where(and(eq(generationJobs.id, id), eq(generationJobs.userEmail, userEmail)))
}

/**
 * Atomowa aktualizacja JEDNEJ pozycji `items[itemIndex]` — merge `patch` do
 * istniejącego obiektu pozycji (`jsonb_set` + operator `||`), NIE
 * read-modify-write po stronie aplikacji. To jest krytyczne dla D4: pula
 * współbieżności kończy kilka pozycji niemal jednocześnie, więc kilka
 * wywołań tej funkcji dla RÓŻNYCH indeksów tego samego wiersza mogą nadejść w
 * bliskim odstępie czasu. Dwa współbieżne `UPDATE` na TEN SAM wiersz
 * serializują się pod blokadą wierszową Postgresa — drugie z nich liczy
 * `jsonb_set` na podstawie już ZATWIERDZONEJ wartości pierwszego, więc żadna
 * aktualizacja nie ginie (w przeciwieństwie do "SELECT items, zmień w JS,
 * UPDATE items", gdzie druga transakcja mogłaby nadpisać efekt pierwszej).
 *
 * `itemIndex` pochodzi WYŁĄCZNIE z pozycji w tablicy zbudowanej po stronie
 * serwera (jobs/route.ts) — nigdy z wejścia użytkownika — więc wstrzyknięcie
 * przez `sql.raw()` jest tu bezpieczne (zawsze liczba całkowita z pętli, nie
 * string z requestu).
 */
export async function updateGenerationJobItem(
  userEmail: string,
  jobId: string,
  itemIndex: number,
  patch: Partial<GenerationJobItem>,
): Promise<void> {
  await getDb()
    .update(generationJobs)
    .set({
      // `::int` na itemIndex jest OBOWIĄZKOWY: bez jawnego rzutowania
      // postgres-js wysyła parametr bez podpowiedzi typu, a Postgres w tej
      // pozycji domyślnie rozwiązuje przeciążenie `jsonb -> text` (klucz
      // obiektu), NIE `jsonb -> integer` (indeks tablicy) — dla tablicy JSON
      // to zawsze NULL niezależnie od zawartości, co dalej przez `|| NULL`
      // zamienia CAŁY wynik jsonb_set w NULL i wywraca NOT NULL na kolumnie
      // (znalezione empirycznie, integration test przeciw prawdziwemu
      // Postgresowi — patrz content-guru.integration.test.ts).
      items: sql`jsonb_set(${generationJobs.items}, ${sql.raw(`'{${itemIndex}}'`)}::text[], (${generationJobs.items}->${itemIndex}::int) || ${JSON.stringify(patch)}::jsonb, false)`,
    })
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userEmail, userEmail)))
}

/** Job jako całość osiąga status końcowy dopiero, gdy WSZYSTKIE pozycje mają
 *  status końcowy (wołane przez orkiestrację PO tym, jak pula współbieżności
 *  zakończy przetwarzanie każdej pozycji, D4 krok 5) — `"done"` jeśli żadna
 *  nie zakończyła się błędem, `"done-with-errors"` jeśli ≥1 tak (częściowy
 *  sukces widoczny, nie ukryty za ogólnym niepowodzeniem). */
export async function finishGenerationJob(
  userEmail: string,
  id: string,
  status: Extract<GenerationJobStatus, "done" | "done-with-errors">,
): Promise<void> {
  await getDb()
    .update(generationJobs)
    .set({ status, completedAt: new Date() })
    .where(and(eq(generationJobs.id, id), eq(generationJobs.userEmail, userEmail)))
}
