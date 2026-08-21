import type { AiToolId } from "@/lib/ai-tools/app-codes"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync, type SQLOutputValue } from "node:sqlite"

export interface AiToolHistoryRecord {
  id: string
  createdAt: string
  toolId: AiToolId
  scope: string
  systemPrompt: string
  userPrompt: string
  content: string
  model: string
  tokensUsed: number | null
  hasImage: boolean
  imageMimeType: string | null
}

export interface SaveAiToolHistoryInput {
  toolId: AiToolId
  scope: string
  systemPrompt: string
  userPrompt: string
  content: string
  model: string
  tokensUsed: number | null
  userEmail: string
  image: { mimeType: string } | undefined
}

type AiToolHistoryRow = Record<string, SQLOutputValue>

const DATABASES = new Map<string, DatabaseSync>()

export function saveAiToolHistoryRecord(input: SaveAiToolHistoryInput): AiToolHistoryRecord {
  const record: AiToolHistoryRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    toolId: input.toolId,
    scope: input.scope,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    content: input.content,
    model: input.model,
    tokensUsed: input.tokensUsed,
    hasImage: Boolean(input.image),
    imageMimeType: input.image?.mimeType ?? null,
  }

  getDatabase(input.toolId)
    .prepare(
      `INSERT INTO history (
        id,
        created_at,
        user_email,
        tool_id,
        scope,
        system_prompt,
        user_prompt,
        content,
        model,
        tokens_used,
        has_image,
        image_mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.createdAt,
      input.userEmail,
      record.toolId,
      record.scope,
      record.systemPrompt,
      record.userPrompt,
      record.content,
      record.model,
      record.tokensUsed,
      record.hasImage ? 1 : 0,
      record.imageMimeType,
    )

  return record
}

export function listAiToolHistory(
  toolId: AiToolId,
  userEmail: string,
  limit: number,
): AiToolHistoryRecord[] {
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const rows = getDatabase(toolId)
    .prepare(
      `SELECT
        id,
        created_at,
        tool_id,
        scope,
        system_prompt,
        user_prompt,
        content,
        model,
        tokens_used,
        has_image,
        image_mime_type
      FROM history
      WHERE user_email = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?`,
    )
    .all(userEmail, safeLimit)

  return rows.map(rowToRecord)
}

export function closeAiToolHistoryDatabasesForTests(): void {
  for (const database of DATABASES.values()) {
    database.close()
  }
  DATABASES.clear()
}

function getDatabase(toolId: AiToolId): DatabaseSync {
  const dbPath = getDatabasePath(toolId)
  const existing = DATABASES.get(dbPath)
  if (existing) return existing

  const database = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true, timeout: 5000 })
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      user_email TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      user_prompt TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_used INTEGER,
      has_image INTEGER NOT NULL DEFAULT 0,
      image_mime_type TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_history_user_created_at
      ON history (user_email, created_at DESC);
  `)
  DATABASES.set(dbPath, database)
  return database
}

function getDatabasePath(toolId: AiToolId): string {
  const directory = getHistoryDirectory()
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
  return path.join(directory, `${toolId}.sqlite`)
}

function getHistoryDirectory(): string {
  const configured = process.env.AI_TOOLS_HISTORY_DIR?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === "production") return path.join("/data", "ai-tools-history")
  return path.join(process.cwd(), ".data", "ai-tools-history")
}

function rowToRecord(row: AiToolHistoryRow): AiToolHistoryRecord {
  return {
    id: asString(row["id"]),
    createdAt: asString(row["created_at"]),
    toolId: asString(row["tool_id"]) as AiToolId,
    scope: asString(row["scope"]),
    systemPrompt: asString(row["system_prompt"]),
    userPrompt: asString(row["user_prompt"]),
    content: asString(row["content"]),
    model: asString(row["model"]),
    tokensUsed: typeof row["tokens_used"] === "number" ? row["tokens_used"] : null,
    hasImage: row["has_image"] === 1 || row["has_image"] === 1n,
    imageMimeType: typeof row["image_mime_type"] === "string" ? row["image_mime_type"] : null,
  }
}

function asString(value: SQLOutputValue | undefined): string {
  return typeof value === "string" ? value : ""
}
