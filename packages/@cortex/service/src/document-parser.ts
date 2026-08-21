// Logika modułu Parser Dokumentów (code-service) — historia zadań ekstrakcji,
// rekordy per-user. Kontrolery w app/idp/app/api/document-parser/** tylko
// walidują wejście i wołają to — zero surowego SQL poza tym plikiem.
//
// Wzorzec DOKŁADNIE wg .claude/skills/code-service/SKILL.md, "Rekordy
// per-user (userEmail)":
//  1. `userEmail` to filtr WIDOCZNOŚCI wpisany w .where() KAŻDEGO zapytania,
//     nigdy fetch-wszystko-i-filtruj-w-JS.
//  2. `getMyJob()` zwraca `undefined` zarówno dla "nie istnieje", jak i
//     "cudze" — route mapuje oba na 404, NIGDY 403.
//  3. `userEmail` to obowiązkowy, pierwszy parametr pozycyjny, pochodzący
//     WYŁĄCZNIE z `access.email` zwróconego przez `requireTileAccess()` —
//     nigdy z ciała/query żądania.
//
// D2/D4 (design doc, PROJECT/cortex-frontend-parser-dokumentow-port-
// projekt.md): backend Python nie ma własnej trwałej bazy — ta tabela i te
// funkcje są jedynym trwałym źródłem prawdy dla historii zadań. mark*()
// funkcje odzwierciedlają stan pobrany z backendu (mirrorowany przy każdym
// pollu GET /jobs/:id, code-api route) — same nigdy nie są wołane
// bezpośrednio z przeglądarki.

import { getDb, jobs, type JobErrorCode, type JobRow } from "@cortex/db"
import { and, desc, eq } from "drizzle-orm"

export const DOCUMENT_PARSER_APP_CODE = "document-parser"

export interface CreateQueuedJobInput {
  id: string
  fileName: string
  fileSizeBytes: number
  mimeType: string
}

/** Filtr jest częścią zapytania, nie osobnym krokiem możliwym do pominięcia.
 *  Bez page/sort/search — CortexDataGrid filtruje/sortuje/paginuje po stronie
 *  przeglądarki nad całą (już przefiltrowaną do usera) tablicą, wzorem
 *  listMyCalculations()/listMyGenerations() (code-service/SKILL.md pkt 4). */
export function listMyJobs(userEmail: string): Promise<JobRow[]> {
  return getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.userEmail, userEmail))
    .orderBy(desc(jobs.createdAt))
}

/** Szczegóły JEDNEGO zadania. Właścicielstwo w WHERE, nie sprawdzane po
 *  fetchu. `undefined` zarówno dla "nie istnieje", jak i "cudze" — route
 *  mapuje oba na 404, NIGDY 403 (403 zdradzałby, że rekord o tym id w ogóle
 *  istnieje). */
export async function getMyJob(userEmail: string, id: string): Promise<JobRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userEmail, userEmail)))
  return row
}

/** D4 krok 2: INSERT status=queued PRZED wywołaniem backendu — wiersz
 *  istnieje zanim wiadomo, czy dispatch do Pythona w ogóle się powiedzie
 *  (dzięki temu porażka dispatchu ma gdzie wylądować jako błąd, patrz
 *  markJobError, zamiast ginąć bez śladu w historii). */
export async function createQueuedJob(
  userEmail: string,
  input: CreateQueuedJobInput,
): Promise<JobRow> {
  const [created] = await getDb()
    .insert(jobs)
    .values({
      id: input.id,
      userEmail,
      status: "queued",
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
    })
    .returning()

  if (!created) throw new Error("Nie udało się utworzyć zadania Parser Dokumentów")
  return created
}

/** D4 krok 3: backend przyjął plik i odpowiedział natychmiast — wiersz
 *  przechodzi queued -> processing i dostaje backend_job_id, po którym route
 *  GET /jobs/:id będzie dalej odpytywał backend przy kolejnych pollach. */
export async function markJobProcessing(
  userEmail: string,
  id: string,
  backendJobId: string,
): Promise<JobRow | undefined> {
  const [updated] = await getDb()
    .update(jobs)
    .set({ status: "processing", backendJobId, startedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(jobs.id, id), eq(jobs.userEmail, userEmail)))
    .returning()
  return updated
}

export interface MarkJobDoneInput {
  markdown: string
  model: string | null
  pageCount: number
  imageCount: number
  truncated: boolean
  elapsedSeconds: number | null
}

export async function markJobDone(
  userEmail: string,
  id: string,
  input: MarkJobDoneInput,
): Promise<JobRow | undefined> {
  const [updated] = await getDb()
    .update(jobs)
    .set({
      status: "done",
      markdown: input.markdown,
      model: input.model,
      pageCount: input.pageCount,
      imageCount: input.imageCount,
      truncated: input.truncated,
      elapsedSeconds: input.elapsedSeconds,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), eq(jobs.userEmail, userEmail)))
    .returning()
  return updated
}

export interface MarkJobErrorInput {
  errorMessage: string
  errorCode: JobErrorCode
  model?: string | null
  pageCount?: number
  imageCount?: number
  truncated?: boolean
  elapsedSeconds?: number | null
}

/** page_count/image_count/truncated mają znaczenie NAWET na ścieżce błędu —
 *  pipeline Pythona potrafi paść PO udanej konwersji (np. błąd wywołania
 *  modelu wizyjnego), więc te liczby odróżniają "konwersja nigdy nie
 *  zadziałała" od "konwersja zadziałała, padł dopiero model" (D1: UI ma
 *  pokazywać różne komunikaty per przyczyna, nie jeden ogólny). */
export async function markJobError(
  userEmail: string,
  id: string,
  input: MarkJobErrorInput,
): Promise<JobRow | undefined> {
  const [updated] = await getDb()
    .update(jobs)
    .set({
      status: "error",
      errorMessage: input.errorMessage,
      errorCode: input.errorCode,
      model: input.model ?? null,
      pageCount: input.pageCount ?? 0,
      imageCount: input.imageCount ?? 0,
      truncated: input.truncated ?? false,
      elapsedSeconds: input.elapsedSeconds ?? null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), eq(jobs.userEmail, userEmail)))
    .returning()
  return updated
}
