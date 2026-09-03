import * as audit from "@cortex/desk-core/audit-log"
import { policyFor, spentToday } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { appendEvent, runTurn } from "@cortex/desk-core/runtime"
import { DESK_LOCALES, makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await whoAmI()
  // Słownik POWYŻEJ pierwszej odmowy — te dwie padają, zanim dojdzie do limitu.
  const translate = await deskT()
  const s = await pool.query(`select owner, title from desk.case_file where id=$1`, [id])
  if (!s.rowCount) {
    return NextResponse.json({ error: translate("api.noSuchCase") }, { status: 404 })
  }
  if (s.rows[0].owner !== u.id) {
    await audit.write(u.id, "access.denied", { caseId: id })
    return NextResponse.json({ error: translate("api.notYourCase") }, { status: 403 })
  }
  const p = await policyFor(u)
  const spent = await spentToday(u.id)
  if (spent >= p.dailyLimitUsd) {
    return NextResponse.json({ error: translate("api.dailyLimit") }, { status: 429 })
  }
  const { text, attachments } = await req.json()
  const files: string[] = Array.isArray(attachments)
    ? attachments.filter((z) => typeof z === "string").slice(0, 10)
    : []
  if (!text?.trim() && !files.length)
    return NextResponse.json({ error: translate("api.emptyJob") }, { status: 400 })

  await appendEvent(id, {
    type: "prompt",
    text: text?.trim() ?? "",
    ...(files.length ? { attachments: files } : {}),
  })
  // Tytuł zastępczy porównujemy we WSZYSTKICH językach, nie z polskim napisem.
  // `case-new.ts` nadaje go przez `translate("api.newCase")`, więc dla `en` brzmi
  // „New case" — a porównanie z „Nowa sprawa" nigdy się dla niego nie zgadzało
  // i sprawa anglojęzycznego użytkownika ZOSTAWAŁA bez tytułu na zawsze. To był
  // skutek uboczny przenoszenia napisów do słownika: poprawiono NADAWANIE,
  // nie poprawiono porównania. Ten sam błąd zrobi każdy, kto tu dopisze kolejny język,
  // więc lista bierze się ze słownika, a nie z ręki.
  const placeholders = new Set(DESK_LOCALES.map((one) => makeDeskT(one)("api.newCase")))
  if (placeholders.has(s.rows[0].title) && text?.trim()) {
    await pool.query(`update desk.case_file set title=$2 where id=$1`, [
      id,
      text.trim().slice(0, 60),
    ])
  }
  await runTurn(u, p, id)
  return NextResponse.json({ ok: true })
}
