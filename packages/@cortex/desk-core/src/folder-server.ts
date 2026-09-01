import "server-only"
import { pool } from "./db"
import * as storage from "./desk-storage"
import type { DeskEvent } from "./types"

/** Ile GOTOWYCH dokumentów ma każda ze spraw — załączniki człowieka się nie liczą. */
export async function countResults(user: string, cases: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!cases.length) return out

  const z = await pool.query<{ case_id: string; payload: DeskEvent }>(
    `select case_id, payload from desk.event
     where case_id = any($1) and payload->>'type' = 'prompt'`,
    [cases],
  )
  const attachments = new Map<string, Set<string>>()
  for (const r of z.rows) {
    if (r.payload.type !== "prompt") continue
    const set = attachments.get(r.case_id) ?? new Set<string>()
    for (const n of r.payload.attachments ?? []) set.add(n)
    attachments.set(r.case_id, set)
  }

  await Promise.all(
    cases.map(async (id) => {
      const files = await storage.list(user, storage.caseFolder(user, id)).catch(() => [])
      const fromHuman = attachments.get(id) ?? new Set<string>()
      out.set(id, files.filter((p) => !p.folder && !fromHuman.has(p.name)).length)
    }),
  )
  return out
}
