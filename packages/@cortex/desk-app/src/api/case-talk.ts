import { accessTo, say, share, unshare } from "@cortex/desk-core/case-access"
import { whoAmI } from "@cortex/desk-core/identity"
import { person } from "@cortex/desk-core/people"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * Rozmowa przy sprawie i udostępnianie jej do wglądu.
 *
 * PISAĆ może każdy, kto sprawę widzi — właściciel i goście. UDOSTĘPNIAĆ wyłącznie
 * właściciel: wgląd w treść cudzej pracy to co innego niż nadzór, więc gość, któremu
 * pokazano jedną sprawę, nie rozdaje jej dalej.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const u = await whoAmI()
  const translate = await deskT()
  const access = await accessTo(id, u.id)
  if (access === "none") {
    return NextResponse.json({ error: translate("api.notYourCase") }, { status: 403 })
  }
  const b = await req.json()

  if (b.action === "say") {
    const text = String(b.text ?? "").trim()
    if (!text) return NextResponse.json({ error: translate("talk.empty") }, { status: 400 })
    return NextResponse.json({ ok: true, message: await say(id, u.id, text) })
  }

  if (access !== "owner") {
    return NextResponse.json({ error: translate("api.ownerShares") }, { status: 403 })
  }
  const who = String(b.who ?? "")
  if (!who || who === u.id || !(await person(who))) {
    return NextResponse.json({ error: translate("api.noSuchPerson") }, { status: 400 })
  }
  if (b.action === "share") {
    await share(id, who, u.id)
    return NextResponse.json({ ok: true })
  }
  if (b.action === "unshare") {
    await unshare(id, who, u.id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: translate("api.unknownDecision") }, { status: 400 })
}
