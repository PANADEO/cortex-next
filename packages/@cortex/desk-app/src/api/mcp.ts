import * as audit from "@cortex/desk-core/audit-log"
import { capabilityCatalogue } from "@cortex/desk-core/capability-gate"
import { whoAmI } from "@cortex/desk-core/identity"
import * as folder from "@cortex/desk-core/mcp/catalogue-store"
import { inspectServer } from "@cortex/desk-core/mcp/client"
import { NoAnswerInTime } from "@cortex/desk-core/mcp/limits"
import {
  AddressNotAllowed,
  ALLOWED_HOSTS_VARIABLE,
  assertAllowedAddress,
} from "@cortex/desk-core/mcp/server-address"
import type { DeskT } from "@cortex/desk-ui/i18n/locale"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * Ekran przyjmowania narzędzi z serwerów MCP. Wyłącznie dla przełożonego —
 * to jedyne miejsce w aplikacji, w którym wykonuje się `tools/list` i w którym widać
 * tekst napisany przez obcego dostawcę.
 */
async function managerOnly() {
  const u = await whoAmI()
  if (u.role !== "management") {
    // Wartość `what` idzie do DZIENNIKA, nie na ekran — zostaje po polsku razem z resztą
    // zapisu, bo dziennik czyta audytor instancji, a nie użytkownik z wybranym językiem.
    await audit.write(u.id, "access.denied", { what: "katalog serwerów MCP" })
    const translate = await deskT()
    return {
      u: null,
      refusal: NextResponse.json({ error: translate("api.managerOnly") }, { status: 403 }),
    }
  }
  return { u, refusal: null }
}

/**
 * Odmowa adresu widziana przez PRZEŁOŻONEGO — a więc przez jedyną osobę, która może
 * z nią coś zrobić. Zdanie mówi wprost, co dopisać i gdzie; sam wyjątek niesie tylko
 * krótką wersję, bo ta sama treść bywa wierszem sprawy czytanym przez pracownika.
 *
 * Cisza serwera dostaje INNE zdanie niż awaria połączenia: „nie odpowiedział" i „nie ma
 * go pod tym adresem" prowadzą przełożonego do dwóch różnych czynności.
 */
function addressRefusal(e: unknown, translate: DeskT): NextResponse | null {
  if (e instanceof AddressNotAllowed) {
    return NextResponse.json(
      {
        error: translate("api.addressNotAllowed", {
          host: e.host,
          variable: ALLOWED_HOSTS_VARIABLE,
          allowed: e.allowed.join(", "),
        }),
      },
      { status: 400 },
    )
  }
  if (e instanceof NoAnswerInTime) {
    return NextResponse.json(
      { error: translate("api.noAnswerInTime", { seconds: Math.round(e.ms / 1000) }) },
      { status: 504 },
    )
  }
  return null
}

export async function GET() {
  const { u, refusal } = await managerOnly()
  if (!u) return refusal
  return NextResponse.json({
    servers: await folder.fullCatalogue(),
    capabilities: capabilityCatalogue,
  })
}

export async function POST(req: Request) {
  const { u, refusal } = await managerOnly()
  if (!u) return refusal
  const d = await req.json()
  const translate = await deskT()

  if (d.action === "add") {
    // Streamable HTTP i nic innego: stdio w aplikacji webowej to nie transport,
    // tylko uruchomienie obcego binarium z uprawnieniami procesu Node.
    if (!/^https?:\/\//.test(d.url ?? "")) {
      return NextResponse.json({ error: translate("api.badUrl") }, { status: 400 })
    }
    if (!/^[a-z0-9-]{2,32}$/.test(d.name ?? "")) {
      return NextResponse.json({ error: translate("api.badName") }, { status: 400 })
    }
    // Adres sprawdzamy PRZED zapisem do katalogu, nie dopiero przy odpytaniu. Adres spoza
    // allow-listy nie ma prawa nawet leżeć w katalogu: raz zapisany, byłby odpytywany przy
    // każdym „Przejrzyj" i przy każdej turze, a przełożony nie miałby jak zobaczyć, że coś
    // jest z nim nie tak, dopóki nie kliknie.
    try {
      assertAllowedAddress(d.url)
    } catch (e) {
      const said = addressRefusal(e, translate)
      if (said) return said
      throw e
    }
    await folder.addServer(u.id, d.name, d.label || d.name, d.url)
    return NextResponse.json({ ok: true })
  }

  if (d.action === "inspect") {
    const servers = await folder.fullCatalogue()
    const s = servers.find((x) => x.name === d.server)
    if (!s) return NextResponse.json({ error: translate("api.noSuchServer") }, { status: 404 })
    try {
      const candidates = await inspectServer(s.url, s.name)
      await audit.write(u.id, "mcp.server.inspected", {
        server: s.name,
        toolCount: candidates.length,
      })
      return NextResponse.json({
        candidates: candidates.map((k) => ({
          remoteName: k.remoteName,
          schema: k.schema,
          foreignDescription: k.foreignDescription,
          rejected: k.rejected,
          // Wstrzymane NIE liczy się jako przyjęte — inaczej ekran chowa formularz
          // dokładnie wtedy, gdy przełożony musi zadziałać.
          alreadyAccepted: s.tools.some(
            (n) => n.remoteName === k.remoteName && n.status === "approved",
          ),
          // przy ponownym przyjęciu nie każemy przepisywać opisu od zera
          previous: s.tools.find((n) => n.remoteName === k.remoteName) ?? null,
        })),
      })
    } catch (e) {
      const said = addressRefusal(e, translate)
      if (said) return said
      return NextResponse.json(
        { error: translate("api.connectFailed", { reason: String(e).slice(0, 160) }) },
        { status: 502 },
      )
    }
  }

  if (d.action === "approve") {
    const servers = await folder.fullCatalogue()
    const s = servers.find((x) => x.name === d.server)
    if (!s) return NextResponse.json({ error: translate("api.noSuchServer") }, { status: 404 })
    if (!d.description?.trim() || !d.shortLabel?.trim()) {
      return NextResponse.json({ error: translate("api.descriptionRequired") }, { status: 400 })
    }
    if (!capabilityCatalogue.some((z) => z.id === d.capability)) {
      return NextResponse.json({ error: translate("api.unknownCapability") }, { status: 400 })
    }

    // Odcisk liczymy z ŻYWEGO schematu w chwili zgody, nie z tego, co przysłała przeglądarka.
    // Inaczej zatwierdzający podpisywałby coś, czego serwer już nie wystawia.
    //
    // Drugie wyjście na sieć pod ten sam adres, więc i drugie miejsce, w którym adres musi
    // przejść bramkę: wpis w katalogu mógł powstać przed wprowadzeniem allow-listy albo
    // zostać zmieniony w bazie z pominięciem tej trasy.
    let candidates
    try {
      candidates = await inspectServer(s.url, s.name)
    } catch (e) {
      const said = addressRefusal(e, translate)
      if (said) return said
      return NextResponse.json(
        { error: translate("api.connectFailed", { reason: String(e).slice(0, 160) }) },
        { status: 502 },
      )
    }
    const k = candidates.find((x) => x.remoteName === d.remoteName)
    if (!k) return NextResponse.json({ error: translate("api.toolGone") }, { status: 409 })
    if (k.rejected) return NextResponse.json({ error: k.rejected }, { status: 422 })

    await folder.approveTool(u.id, {
      server: s.name,
      remoteName: d.remoteName,
      description: d.description.trim(),
      shortLabel: d.shortLabel.trim(),
      capabilityId: d.capability,
      fingerprint: k.fingerprintOf(d.description.trim()),
    })
    return NextResponse.json({ ok: true })
  }

  if (d.action === "withdraw") {
    await folder.withdrawTool(u.id, d.server, d.remoteName)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: translate("api.unknownAction") }, { status: 400 })
}
