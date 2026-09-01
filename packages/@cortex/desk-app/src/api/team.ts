import * as audit from "@cortex/desk-core/audit-log"
import { capabilityCatalogue, policyFor, spentToday } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import {
  everyone,
  isDepartment,
  isRole,
  setActive,
  setDailyLimit,
  setDepartment,
  setRole,
} from "@cortex/desk-core/people"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * ZESPÓŁ — jedyne miejsce, w którym przełożony widzi swoich ludzi, a nie tylko prośby,
 * które ktoś do niego wysłał.
 *
 * Nadanie zdolności DAŁO SIĘ zrobić już wcześniej, ale wyłącznie w odpowiedzi na prośbę.
 * Odebranie też — i tylko przez ten sam wiersz prośby. Znaczyło to, że zdolności, o którą
 * nikt nie prosił, nie dało się odebrać w ogóle: nie było wiersza, przez który by to zrobić.
 * Tutaj kluczem jest para (osoba, zdolność), a nie identyfikator prośby.
 */

async function manager() {
  const u = await whoAmI()
  const translate = await deskT()
  if (u.role !== "management") {
    // `what` idzie do dziennika, nie na ekran — zostaje w języku instancji.
    await audit.write(u.id, "access.denied", { what: "zarządzanie zespołem" })
    return { error: NextResponse.json({ error: translate("api.managerDecides") }, { status: 403 }) }
  }
  return { u, translate }
}

export async function GET() {
  await migrate()
  const gate = await manager()
  if (gate.error) return gate.error

  const [team, waiting, direct] = await Promise.all([
    everyone(),
    pool.query<{ who: string; capability: string }>(
      `select who, capability from desk.access_request where status='pending'`,
    ),
    // Nadania WPROST, osobno od tego, co daje rola. Bez tego rozróżnienia ekran
    // proponowałby odebranie zdolności, która wróci przy następnym odczycie polityki.
    pool.query<{ who: string; capability: string }>(`select who, capability from desk.grant`),
  ])

  const people = await Promise.all(
    team.map(async (person) => {
      const [policy, usd] = await Promise.all([policyFor(person), spentToday(person.id)])
      return {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        department: person.department,
        role: person.role,
        active: person.active !== false,
        // Nadane WPROST, ponad rolę — tylko te da się odebrać, i tylko to widać
        // na ekranie jako coś, co ktoś kiedyś zdecydował.
        granted: policy.granted.map((z) => z.id),
        grantedDirectly: direct.rows.filter((r) => r.who === person.id).map((r) => r.capability),
        blocked: policy.blocked.map((z) => z.id),
        pending: waiting.rows.filter((r) => r.who === person.id).map((r) => r.capability),
        spentUsd: usd,
        dailyLimitUsd: policy.dailyLimitUsd,
        // Czy limit jest WŁASNY osoby, czy odziedziczony z roli — ekran musi to
        // rozróżniać, bo „wróć do wartości z roli" to inna operacja niż „ustaw zero".
        ownLimit: person.dailyLimitUsd ?? null,
      }
    }),
  )
  return NextResponse.json({ people })
}

export async function POST(req: Request) {
  await migrate()
  const gate = await manager()
  if (gate.error) return gate.error
  const { u, translate } = gate
  const b = await req.json()
  const who = String(b.who ?? "")

  if (b.action === "role") {
    if (!isRole(b.role)) {
      return NextResponse.json({ error: translate("api.unknownDecision") }, { status: 400 })
    }
    // Odebranie sobie roli przełożonego zamyka ten ekran przed tym, kto właśnie na nim
    // stoi — i jeśli jest jedynym przełożonym, przed wszystkimi na zawsze.
    if (who === u.id && b.role !== "management") {
      return NextResponse.json({ error: translate("api.cannotDemoteSelf") }, { status: 400 })
    }
    await setRole(who, b.role, u.id)
    return NextResponse.json({ ok: true })
  }

  if (b.action === "department") {
    if (!isDepartment(b.department)) {
      return NextResponse.json({ error: translate("api.unknownDepartment") }, { status: 400 })
    }
    await setDepartment(who, b.department, u.id)
    return NextResponse.json({ ok: true })
  }

  if (b.action === "active") {
    // Ten sam powód, co przy roli: przełożony, który wyłączy sam siebie, zamyka ten
    // ekran przed sobą i nie ma już jak tego cofnąć.
    if (who === u.id) {
      return NextResponse.json({ error: translate("api.cannotDisableSelf") }, { status: 400 })
    }
    await setActive(who, Boolean(b.active), u.id)
    return NextResponse.json({ ok: true })
  }

  if (b.action === "limit") {
    const raw = b.usd
    const usd = raw === null || raw === "" ? null : Number(raw)
    if (usd !== null && (!Number.isFinite(usd) || usd < 0)) {
      return NextResponse.json({ error: translate("api.limitMustBeNumber") }, { status: 400 })
    }
    await setDailyLimit(who, usd, u.id)
    return NextResponse.json({ ok: true })
  }

  const capability = String(b.capability ?? "")
  if (!capabilityCatalogue.some((z) => z.id === capability)) {
    return NextResponse.json({ error: translate("api.noSuchCapability") }, { status: 400 })
  }

  if (b.action === "grant") {
    await pool.query(
      `insert into desk.grant (who, capability, granted_by) values ($1,$2,$3)
       on conflict (who, capability) do nothing`,
      [who, capability, u.id],
    )
    // Prośba o to samo przestaje czekać — inaczej przełożony widziałby ją dalej
    // w „Do decyzji", mimo że sam już zdecydował.
    await pool.query(
      `update desk.access_request set status='granted', decided_at=now(), decided_by=$3
       where who=$1 and capability=$2 and status='pending'`,
      [who, capability, u.id],
    )
    await audit.write(u.id, "capability.granted", { toWhom: who, capability })
    return NextResponse.json({ ok: true })
  }

  if (b.action === "revoke") {
    await pool.query(`delete from desk.grant where who=$1 and capability=$2`, [who, capability])
    await audit.write(u.id, "capability.revoked", { toWhom: who, capability })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: translate("api.unknownDecision") }, { status: 400 })
}
