// Schemat modułu Parser Dokumentów — PROJECT/cortex-frontend-parser-
// dokumentow-port-projekt.md §4. Jedna tabela: historia zadań ekstrakcji,
// per-user (.claude/skills/code-service/SKILL.md "Rekordy per-user").
//
// Backend Python (services/document-parser/) NIE MA własnej trwałej bazy
// (D2) — ta tabela jest jedynym trwałym źródłem prawdy dla historii zadań.
// Właścicielem odczytu/zapisu jest Next.js BFF (code-api routes pod
// app/idp/app/api/document-parser/**, Faza 2 — POZA ZAKRESEM tej zmiany:
// ta zmiana dodaje wyłącznie schemat/migrację). Gdy Faza 2 startuje, funkcje
// listMyJobs()/getMyJob() mają żyć w @cortex/service/src/document-parser.ts,
// NIE lokalnie w module — patrz code-service/SKILL.md "Rekordy per-user",
// uwaga o korekcie względem tego, co ten design doc pierwotnie zakładał.
//
// Bez tabeli na oryginalne pliki (D5) — nie przechowujemy wgranych
// dokumentów po zakończeniu przetwarzania, tylko wynikowy Markdown jako
// text. Sam plik żyje wyłącznie przez czas requestu multipart do backendu.

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const documentParser = pgSchema("document_parser")

export const JOB_STATUSES = ["queued", "processing", "done", "error"] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

// Rozróżnialne literały (nie jeden ogólny "processing failed") — D1 wymaga,
// żeby UI mógł pokazać różne komunikaty per przyczyna błędu. Backend Python
// dziś zwraca wyłącznie wolny tekst (error_message) — mapowanie na te
// literały jest zadaniem Next.js BFF (Faza 2), stąd kolumna jest gotowa, ale
// żaden kod w tej zmianie jej jeszcze nie zapisuje.
export const JOB_ERROR_CODES = [
  "unsupported-format",
  "file-too-large",
  "conversion-failed",
  "vision-call-failed",
  "page-limit-exceeded",
] as const
export type JobErrorCode = (typeof JOB_ERROR_CODES)[number]

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()

export const jobs = documentParser.table(
  "jobs",
  {
    // nanoid, ten sam identyfikator co widzi przeglądarka — generowany przez
    // Next.js BFF przy INSERCIE (Faza 2), nie tutaj (brak .default(), wzorem
    // ilustromat.frame_templates.id).
    id: text("id").primaryKey(),
    // Id po stronie backendu Python — do odpytywania GET /jobs/{id} tam.
    // Nullable: backend jest wywoływany PO insercie wiersza (D4 krok 2),
    // więc na moment powstania wiersza jeszcze go nie ma.
    backendJobId: text("backend_job_id"),
    // Właściciel rekordu — filtr WIDOCZNOŚCI (code-service "Rekordy
    // per-user" pkt 1), nie ślad audytowy.
    userEmail: text("user_email").notNull(),
    status: text("status").notNull().default("queued"),
    fileName: text("file_name").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    // Model faktycznie użyty do ekstrakcji — nullable, bo nieznany dopóki
    // backend nie zacznie/skończy przetwarzania (DOCUMENT_PARSER_VISION_MODEL
    // rozstrzygane po stronie backendu, D7/Q3).
    model: text("model"),
    markdown: text("markdown"),
    errorMessage: text("error_message"),
    errorCode: text("error_code"),
    pageCount: integer("page_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    truncated: boolean("truncated").notNull().default(false),
    elapsedSeconds: doublePrecision("elapsed_seconds"),
    createdAt,
    updatedAt,
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    // code-service "Rekordy per-user" pkt: dokładnie ta para kolumn,
    // dokładnie w tej kolejności — każde zapytanie tego modułu filtruje po
    // userEmail i sortuje po createdAt.
    byUserCreatedAt: index("jobs_user_email_created_at_idx").on(table.userEmail, table.createdAt),
    statusAllowed: check(
      "jobs_status_allowed",
      sql`${table.status} in ('queued', 'processing', 'done', 'error')`,
    ),
    errorCodeAllowed: check(
      "jobs_error_code_allowed",
      sql`${table.errorCode} is null or ${table.errorCode} in (
        'unsupported-format', 'file-too-large', 'conversion-failed',
        'vision-call-failed', 'page-limit-exceeded'
      )`,
    ),
  }),
)

export type JobRow = typeof jobs.$inferSelect
export type JobInsert = typeof jobs.$inferInsert
