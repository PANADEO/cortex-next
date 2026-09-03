import { accessTo, share, unshare } from "@cortex/desk-core/case-access"
import { whoAmI } from "@cortex/desk-core/identity"
import { person } from "@cortex/desk-core/people"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * UDOSTĘPNIANIE SPRAWY DO WGLĄDU — i nic poza tym.
 *
 * Udostępnia wyłącznie WŁAŚCICIEL: wgląd w treść cudzej pracy to co innego niż nadzór,
 * więc gość, któremu pokazano jedną sprawę, nie rozdaje jej dalej.
 *
 * PISANIE WIADOMOŚCI ZOSTAŁO USUNIĘTE 03.09.2026, decyzją właściciela produktu.
 * Była to druga droga rozmowy w produkcie, który ma jedną — obok sprawy, obok dowodu
 * i obok wszystkiego, co ten produkt umie pokazać. Firma ma do tego pocztę i komunikator.
 * Gość ma widzieć sprawę i nic więcej.
 *
 * Wiersze zapisane wcześniej ZOSTAJĄ w bazie. Kasowanie cudzych zdań przy zmianie
 * zakresu produktu byłoby zniszczeniem danych, a nie sprzątaniem — trasa po prostu
 * przestaje ich przyjmować i ekran przestaje je pokazywać.
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
