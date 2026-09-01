import * as audit from "@cortex/desk-core/audit-log"
import { policyFor, spentToday } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { appendEvent, runTurn } from "@cortex/desk-core/runtime"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await whoAmI()
  const s = await pool.query(`select owner, title from desk.case_file where id=$1`, [id])
  if (!s.rowCount) return NextResponse.json({ error: "Nie ma takiej sprawy." }, { status: 404 })
  if (s.rows[0].owner !== u.id) {
    await audit.write(u.id, "access.denied", { caseId: id })
    return NextResponse.json({ error: "To nie jest Twoja sprawa." }, { status: 403 })
  }
  const p = await policyFor(u)
  const spent = await spentToday(u.id)
  const translate = await deskT()
  if (spent >= p.dailyLimitUsd) {
    return NextResponse.json({ error: translate("api.dailyLimit") }, { status: 429 })
  }
  const { text, attachments } = await req.json()
  const files: string[] = Array.isArray(attachments)
    ? attachments.filter((z) => typeof z === "string").slice(0, 10)
    : []
  if (!text?.trim() && !files.length)
    return NextResponse.json({ error: "Puste zlecenie." }, { status: 400 })

  await appendEvent(id, {
    type: "prompt",
    text: text?.trim() ?? "",
    ...(files.length ? { attachments: files } : {}),
  })
  if (s.rows[0].title === "Nowa sprawa" && text?.trim()) {
    await pool.query(`update desk.case_file set title=$2 where id=$1`, [
      id,
      text.trim().slice(0, 60),
    ])
  }
  await runTurn(u, p, id)
  return NextResponse.json({ ok: true })
}
