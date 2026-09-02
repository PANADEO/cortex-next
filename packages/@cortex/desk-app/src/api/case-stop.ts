import * as audit from "@cortex/desk-core/audit-log"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { appendEvent } from "@cortex/desk-core/runtime"
import { stopTurn } from "@cortex/desk-core/turn-control"
import { NextResponse } from "next/server"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await whoAmI()
  const translate = await deskT()
  const s = await pool.query(`select owner from desk.case_file where id=$1`, [id])
  if (!s.rowCount || s.rows[0].owner !== u.id)
    return NextResponse.json({ error: translate("api.notYourCase") }, { status: 403 })
  // NAJPIERW przerwij pracę, potem zapisz stan. Odwrotna kolejność zostawiała okno,
  // w którym tura zdążyła domknąć się sama i nadpisać „przerwane" na „gotowe".
  stopTurn(id)
  await pool.query(
    `update desk.case_file set status='stopped', reason='przerwane przez Ciebie', updated_at=now() where id=$1 and status='working'`,
    [id],
  )
  await appendEvent(id, {
    type: "lifecycle",
    status: "stopped",
    reason: "przerwane przez Ciebie",
  })
  await audit.write(u.id, "turn.stopped", { caseId: id })
  return NextResponse.json({ ok: true })
}
