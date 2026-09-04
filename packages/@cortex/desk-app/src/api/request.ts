import * as audit from "@cortex/desk-core/audit-log"
import { capabilityCatalogue } from "@cortex/desk-core/capability-gate"
import { capabilityLabel } from "@cortex/desk-core/capability-text"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { names } from "@cortex/desk-core/people"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

export async function GET() {
  await migrate()
  const u = await whoAmI()
  const [translate, people] = await Promise.all([deskT(), names()])
  // pracownik widzi wyłącznie swoje prośby; zarząd — wszystkie oczekujące
  const r =
    u.role === "management"
      ? await pool.query(
          `select * from desk.access_request order by (status='pending') desc, at desc limit 50`,
        )
      : await pool.query(
          `select * from desk.access_request where who=$1 order by at desc limit 50`,
          [u.id],
        )

  return NextResponse.json({
    requests: r.rows.map((p) => ({
      id: Number(p.id),
      who: p.who,
      whoName: people[p.who] ?? p.who,
      capability: p.capability,
      name:
        p.capability === "other"
          ? translate("api.somethingOutside")
          : capabilityLabel(translate, p.capability, p.capability),
      department: capabilityCatalogue.find((z) => z.id === p.capability)?.department ?? "",
      justification: p.justification ?? null,
      status: p.status,
      at: p.at,
      decidedAt: p.decided_at,
    })),
  })
}

export async function POST(req: Request) {
  await migrate()
  const u = await whoAmI()
  const { capability, justification } = await req.json()
  const translate = await deskT()

  // Prośba własnymi słowami — o coś, czego w katalogu jeszcze nie ma. Nie da się jej
  // przyznać jednym kliknięciem i nie udajemy, że się da; trafia do przełożonego
  // jako sygnał, że katalog czegoś nie obejmuje.
  if (capability === "other") {
    const text = String(justification ?? "")
      .trim()
      .slice(0, 500)
    if (!text)
      return NextResponse.json({ error: translate("api.writeWhatYouNeed") }, { status: 400 })
    await pool.query(
      `insert into desk.access_request (who, capability, justification) values ($1,'other',$2)`,
      [u.id, text],
    )
    await audit.write(u.id, "request.other", { description: text })
    return NextResponse.json({ ok: true })
  }

  if (!capabilityCatalogue.some((z) => z.id === capability)) {
    return NextResponse.json({ error: translate("api.noSuchCapability") }, { status: 400 })
  }
  // druga prośba o to samo nie tworzy drugiego wiersza — dział ma widzieć jedną sprawę
  const exists = await pool.query(
    `select id from desk.access_request where who=$1 and capability=$2 and status='pending'`,
    [u.id, capability],
  )
  if (!exists.rowCount) {
    await pool.query(`insert into desk.access_request (who, capability) values ($1,$2)`, [
      u.id,
      capability,
    ])
  }
  await audit.write(u.id, "request.opened", { capability })
  return NextResponse.json({ ok: true })
}

/** Rozpatrzenie prośby. Przyznanie NAPRAWDĘ nadaje zdolność — inaczej to teatr. */
export async function PATCH(req: Request) {
  await migrate()
  const u = await whoAmI()
  const translate = await deskT()
  if (u.role !== "management") {
    // `what` idzie do dziennika, nie na ekran — zostaje w języku instancji.
    await audit.write(u.id, "access.denied", { what: "rozpatrywanie próśb" })
    return NextResponse.json({ error: translate("api.managerDecides") }, { status: 403 })
  }
  const { id, decision, revoke } = await req.json()

  // Cofnięcie nadania — bez tego nie da się zresetować pokazu ani odebrać zdolności,
  // która okazała się nadana przez pomyłkę.
  if (revoke) {
    const r = await pool.query(`select who, capability from desk.access_request where id=$1`, [id])
    if (!r.rowCount)
      return NextResponse.json({ error: translate("api.noSuchRequest") }, { status: 404 })
    const { who, capability } = r.rows[0]
    await pool.query(`delete from desk.grant where who=$1 and capability=$2`, [who, capability])
    await pool.query(
      `update desk.access_request set status='denied', decided_at=now(), decided_by=$2 where id=$1`,
      [id, u.id],
    )
    await audit.write(u.id, "capability.revoked", { toWhom: who, capability })
    return NextResponse.json({ ok: true })
  }

  if (decision !== "granted" && decision !== "denied") {
    return NextResponse.json({ error: translate("api.unknownDecision") }, { status: 400 })
  }
  const r = await pool.query(
    `select who, capability, status from desk.access_request where id=$1`,
    [id],
  )
  if (!r.rowCount)
    return NextResponse.json({ error: translate("api.noSuchRequest") }, { status: 404 })
  if (r.rows[0].status !== "pending") {
    return NextResponse.json({ error: translate("api.alreadyDecided") }, { status: 409 })
  }
  const { who, capability } = r.rows[0]

  // ODMOWA PRZED ZAPISEM, nie po nim. Prośba „o coś spoza katalogu" nie ma czego nadać
  // i ekran przełożonego słusznie nie pokazuje przy niej przycisku nadania — ale trasa
  // dawała się zawołać wprost, a wtedy działy się trzy rzeczy naraz i każda mówiła co
  // innego: baza zapisywała „przyznane", wołający dostawał 400, a wpis do dziennika
  // NIE POWSTAWAŁ, bo `audit.write` stoi za tym zwrotem. Prośby nie dało się potem
  // rozpatrzyć drugi raz — kolejne wywołanie odbijało się o 409 „już rozstrzygnięta".
  // Teraz prośba zostaje `pending`, czyli w stanie, w którym naprawdę jest.
  if (capability === "other" && decision === "granted") {
    return NextResponse.json({ error: translate("api.notGrantable") }, { status: 400 })
  }
  await pool.query(
    `update desk.access_request set status=$2, decided_at=now(), decided_by=$3 where id=$1`,
    [id, decision, u.id],
  )
  if (decision === "granted") {
    await pool.query(
      `insert into desk.grant (who, capability, granted_by) values ($1,$2,$3)
       on conflict (who, capability) do nothing`,
      [who, capability, u.id],
    )
  }
  await audit.write(u.id, `request.${decision}`, { toWhom: who, capability })
  return NextResponse.json({ ok: true })
}
