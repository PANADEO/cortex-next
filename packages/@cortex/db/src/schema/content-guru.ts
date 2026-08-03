// Schemat modułu Content Guru — port fm-content-generator/content_guru.py
// (PoC Streamlit) na natywny kafelek. PROJECT/cortex-frontend-content-guru-
// full-port-projekt.md §5 (Faza 0: WYŁĄCZNIE ten schemat + migracja — CRUD,
// generowanie i orkiestracja batch/pakietu to Faza 1+, poza zakresem tej
// zmiany).
//
// Sześć tabel: `templates` (WSPÓLNE między userami — struktura 1:1 z
// `ilustromat.frame_templates`, `createdBy` to tylko ślad audytowy, NIE
// filtr widoczności), cztery tabele PER-USER (`client_profiles`,
// `market_profiles`, `forbidden_phrases`, `content_archive` — dosłowny
// wzorzec `.claude/skills/code-service/SKILL.md` "Rekordy per-user":
// `userEmail`, nie `ownerId`/FK, filtr w `.where()` każdego zapytania
// serwisowego, Faza 1+), i `generation_jobs` — NOWA tabela, nie z legacy,
// nośnik async joba dla trybów batch/pakiet (D4: N niezależnych równoległych
// wywołań cortex-proxy z per-pozycyjnym postępem, nie legacy'owy
// single-call-JSON-z-fallbackiem).
//
// Logika serwisowa dotykająca tych tabel (CRUD, listMy*/getMy*, orkiestracja
// jobów) żyje w @cortex/service/src/content-guru.ts (code-service "Rekordy
// per-user"), NIGDY w app/idp/lib/content-guru/ — ten drugi folder jest
// zarezerwowany dla logiki, która nigdy nie dotyka Drizzle (prompt builder,
// adapter cortex-proxy, config). Zero takiej logiki serwisowej istnieje
// jeszcze w tej zmianie — to jest wyłącznie schemat.
//
// Świadomie NIE portowane z legacy (design doc, sekcja "Korekty"):
//  - `db_metadata` (wersjonowanie schematu) — Drizzle ma własny mechanizm
//    migracji, nie ma czego portować.
//  - `client_profiles.logo_path`/`images_json` — martwe pola, nieużywane
//    przez `_profile_to_markdown()` w legacy (korekta #4).

import { sql } from "drizzle-orm"
import { check, index, jsonb, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const contentGuru = pgSchema("content_guru")

export const CONTENT_ARCHIVE_STATUSES = ["done", "done-with-warnings"] as const
export type ContentArchiveStatus = (typeof CONTENT_ARCHIVE_STATUSES)[number]

export const GENERATION_JOB_MODES = ["batch", "package"] as const
export type GenerationJobMode = (typeof GENERATION_JOB_MODES)[number]

export const GENERATION_JOB_STATUSES = ["queued", "running", "done", "done-with-errors"] as const
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number]

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()

/**
 * Szablony treści — zasób WSPÓLNY między wszystkimi userami kafelka (brak
 * kolumny właściciela w legacy `templates(id, name, category, path, content)`
 * — struktura 1:1 z `ilustromat.frame_templates`). `createdBy` jest śladem
 * audytowym, NIE filtrem widoczności (code-service "Rekordy per-user" pkt 1,
 * "nie mylić z createdBy"). `category` zostaje wolnym tekstem jak legacy
 * (`default('Główne')`), nie enumem — `get_content_types_from_templates()`
 * buduje listę kategoria/nazwa dynamicznie z bazy.
 *
 * CRUD (Faza 3) ma być gated dodatkowym scope'em `manage-templates` NAD
 * `requireTileAccess("content-guru")` — wzorem Ilustromatu (design doc D6/D9)
 * — poza zakresem tej zmiany (Faza 0 nie dodaje żadnego RBAC poza tym, co już
 * istnieje dla samego kafelka).
 */
export const templates = contentGuru.table(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Główne"),
    content: text("content").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => ({
    // Port `uq_templates_path` z legacy (path = category/name) — wolno mieć
    // dwa szablony o tej samej nazwie w różnych kategoriach, nie w tej samej.
    uniqueCategoryName: unique("templates_category_name_unique").on(table.category, table.name),
  }),
)

/**
 * Profile klienta — PER-USER (code-service "Rekordy per-user"). Pola 1:1 z
 * legacy `client_profiles`, BEZ `logo_path`/`images_json` (martwe, korekta
 * #4 — `_profile_to_markdown()` ich nie czyta). Wybrany profil renderuje się
 * jako blok Markdown wstrzykiwany do system promptu (Faza 1, `lib/content-guru/`).
 */
export const clientProfiles = contentGuru.table(
  "client_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Właściciel rekordu — filtr WIDOCZNOŚCI, nie ślad audytowy.
    userEmail: text("user_email").notNull(),
    profileName: text("profile_name").notNull(),
    history: text("history"),
    description: text("description"),
    products: text("products"),
    offer: text("offer"),
    useCases: text("use_cases"),
    experience: text("experience"),
    createdAt,
    updatedAt,
  },
  (table) => ({
    uniqueUserProfile: unique("client_profiles_user_email_profile_name_unique").on(
      table.userEmail,
      table.profileName,
    ),
    byUser: index("client_profiles_user_email_idx").on(table.userEmail),
  }),
)

/** Profile rynku — PER-USER, kształt równoległy do `clientProfiles` powyżej,
 *  pola 1:1 z legacy `market_profiles`. */
export const marketProfiles = contentGuru.table(
  "market_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    profileName: text("profile_name").notNull(),
    description: text("description"),
    sizeTrends: text("size_trends"),
    personas: text("personas"),
    problems: text("problems"),
    needs: text("needs"),
    plans: text("plans"),
    createdAt,
    updatedAt,
  },
  (table) => ({
    uniqueUserProfile: unique("market_profiles_user_email_profile_name_unique").on(
      table.userEmail,
      table.profileName,
    ),
    byUser: index("market_profiles_user_email_idx").on(table.userEmail),
  }),
)

/**
 * Zakazane frazy — PER-USER. Port legacy `forbidden_phrases(author_email,
 * phrase, description)` — kolumna właściciela przemianowana na `userEmail`
 * zgodnie z konwencją (legacy nazwa była semantycznie dokładnie tym samym,
 * design doc sekcja 1.4). W Faza 2 dostają dwuwarstwową walidację (wstrzyknięcie
 * do promptu + post-generacyjny skan z eskalowanym retry, D5) — w Fazie 0 to
 * wyłącznie magazyn danych.
 */
export const forbiddenPhrases = contentGuru.table(
  "forbidden_phrases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    phrase: text("phrase").notNull(),
    description: text("description"),
    createdAt,
  },
  (table) => ({
    byUser: index("forbidden_phrases_user_email_idx").on(table.userEmail),
  }),
)

/**
 * Archiwum wygenerowanych treści — PER-USER, zastępuje dzisiejszą SQLite-ową
 * historię AI Tools dla tego narzędzia (nie migrowaną wiersz-po-wierszu przy
 * cutover, design doc §9 p.6). Płaskie kolumny (`contentType`/`status`/
 * `createdAt`) wyłącznie pod sort/filtr przyszłego `CortexDataGrid` (Faza 7);
 * `metadata` jako `jsonb` bez ręcznego JSON.stringify na każdym polu jak
 * 27-kolumnowe legacy SQLite.
 *
 * `status`/`matchedForbiddenPhrases` istnieją już teraz (Faza 0), mimo że
 * nic jeszcze ich nie zapisuje — D5 (walidacja zakazanych fraz) jest Faza 2,
 * ale kolumna należy do kształtu archiwum, nie do logiki, która ją wypełnia.
 */
export const contentArchive = contentGuru.table(
  "content_archive",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    contentType: text("content_type").notNull(),
    topic: text("topic"),
    generatedContent: text("generated_content").notNull(),
    status: text("status").notNull().default("done"),
    matchedForbiddenPhrases: text("matched_forbidden_phrases").array(),
    targetAudience: text("target_audience"),
    additionalInfo: text("additional_info"),
    keywordPhrase: text("keyword_phrase"),
    metaDescription: text("meta_description"),
    modelUsed: text("model_used").notNull(),
    clientProfileId: uuid("client_profile_id").references(() => clientProfiles.id, {
      onDelete: "set null",
    }),
    marketProfileId: uuid("market_profile_id").references(() => marketProfiles.id, {
      onDelete: "set null",
    }),
    // generation_mode/batch_position/batch_total itd. — bez sztywnych kolumn,
    // wzorem geo-score-calculator.calculations.result.
    metadata: jsonb("metadata").notNull().default({}),
    createdAt,
  },
  (table) => ({
    // code-service "Rekordy per-user": dokładnie ta para kolumn, dokładnie w
    // tej kolejności — każde zapytanie tego modułu filtruje po userEmail i
    // sortuje po createdAt.
    byUserCreatedAt: index("content_archive_user_email_created_at_idx").on(
      table.userEmail,
      table.createdAt,
    ),
    statusAllowed: check(
      "content_archive_status_allowed",
      sql`${table.status} in ('done', 'done-with-warnings')`,
    ),
  }),
)

/**
 * Joby generowania batch/pakiet — NOWA tabela, nie z legacy (D4). Nośnik
 * async orkiestracji: `items` to tablica
 * `{templateId,templateLabel,topic,status,content?,archiveId?,error?}`,
 * aktualizowana pozycyjnie w miarę kończenia się poszczególnych wywołań
 * cortex-proxy (Faza 5+). PER-USER, ten sam wzorzec indeksu co
 * `content_archive`.
 */
export const generationJobs = contentGuru.table(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("queued"),
    items: jsonb("items").notNull().default([]),
    createdAt,
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    byUserCreatedAt: index("generation_jobs_user_email_created_at_idx").on(
      table.userEmail,
      table.createdAt,
    ),
    modeAllowed: check("generation_jobs_mode_allowed", sql`${table.mode} in ('batch', 'package')`),
    statusAllowed: check(
      "generation_jobs_status_allowed",
      sql`${table.status} in ('queued', 'running', 'done', 'done-with-errors')`,
    ),
  }),
)

export type TemplateRow = typeof templates.$inferSelect
export type TemplateInsert = typeof templates.$inferInsert
export type ClientProfileRow = typeof clientProfiles.$inferSelect
export type ClientProfileInsert = typeof clientProfiles.$inferInsert
export type MarketProfileRow = typeof marketProfiles.$inferSelect
export type MarketProfileInsert = typeof marketProfiles.$inferInsert
export type ForbiddenPhraseRow = typeof forbiddenPhrases.$inferSelect
export type ForbiddenPhraseInsert = typeof forbiddenPhrases.$inferInsert
export type ContentArchiveRow = typeof contentArchive.$inferSelect
export type ContentArchiveInsert = typeof contentArchive.$inferInsert
export type GenerationJobRow = typeof generationJobs.$inferSelect
export type GenerationJobInsert = typeof generationJobs.$inferInsert
