import { accessTo, sharesOf } from "@cortex/desk-core/case-access"
import { migrate, pool } from "@cortex/desk-core/db"
import * as storage from "@cortex/desk-core/desk-storage"
import { whoAmI } from "@cortex/desk-core/identity"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await whoAmI()
  const translate = await deskT()
  const from = Number(new URL(req.url).searchParams.get("from") ?? 0)
  const s = await pool.query(
    `select owner, title, status, reason, cost_usd::float8 as cost, updated_at as "updatedAt" from desk.case_file where id=$1`,
    [id],
  )
  if (!s.rowCount) {
    return NextResponse.json({ error: translate("api.noSuchCase") }, { status: 404 })
  }
  const access = await accessTo(id, u.id)
  if (access === "none")
    return NextResponse.json({ error: translate("api.notYourCase") }, { status: 403 })

  const z = await pool.query(
    `select seq, at, payload from desk.event where case_id=$1 and seq>$2 order by seq`,
    [id, from],
  )
  // Teczka leży u WŁAŚCICIELA, nie u patrzącego — gość ogląda cudzą pracę, nie swoją.
  const owner: string = s.rows[0].owner
  const folder = await storage.list(owner, storage.caseFolder(owner, id)).catch(() => [])
  return NextResponse.json({
    caseFile: {
      id,
      title: s.rows[0].title,
      status: s.rows[0].status,
      reason: s.rows[0].reason,
      cost: s.rows[0].cost,
      updatedAt: s.rows[0].updatedAt,
    },
    events: z.rows.map((r) => ({ seq: Number(r.seq), at: r.at, event: r.payload })),
    folder,
    access,
    owner,
    // Wiadomości ludzi jadą OBOK zdarzeń, nie wśród nich: model dostaje `events`,
    // a tego nie dostaje nigdy.
    shares: access === "owner" ? await sharesOf(id) : [],
  })
}
