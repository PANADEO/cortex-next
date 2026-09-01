import * as audit from "@cortex/desk-core/audit-log"
import { capabilityCatalogue } from "@cortex/desk-core/capability-gate"
import { whoAmI } from "@cortex/desk-core/identity"
import * as folder from "@cortex/desk-core/mcp/catalogue-store"
import { inspectServer } from "@cortex/desk-core/mcp/client"
import { NextResponse } from "next/server"

/**
 * Ekran przyjmowania narzędzi z serwerów MCP. Wyłącznie dla przełożonego —
 * to jedyne miejsce w aplikacji, w którym wykonuje się `tools/list` i w którym widać
 * tekst napisany przez obcego dostawcę.
 */
async function managerOnly() {
  const u = await whoAmI()
  if (u.role !== "management") {
    await audit.write(u.id, "access.denied", { what: "katalog serwerów MCP" })
    return {
      u: null,
      refusal: NextResponse.json({ error: "To robi przełożony." }, { status: 403 }),
    }
  }
  return { u, refusal: null }
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

  if (d.action === "dodaj") {
    // Streamable HTTP i nic innego: stdio w aplikacji webowej to nie transport,
    // tylko uruchomienie obcego binarium z uprawnieniami procesu Node.
    if (!/^https?:\/\//.test(d.url ?? "")) {
      return NextResponse.json(
        { error: "Adres musi zaczynać się od http:// albo https://." },
        { status: 400 },
      )
    }
    if (!/^[a-z0-9-]{2,32}$/.test(d.name ?? "")) {
      return NextResponse.json(
        { error: "Nazwa techniczna: małe litery, cyfry i myślnik." },
        { status: 400 },
      )
    }
    await folder.addServer(u.id, d.name, d.label || d.name, d.url)
    return NextResponse.json({ ok: true })
  }

  if (d.action === "przejrzyj") {
    const servers = await folder.fullCatalogue()
    const s = servers.find((x) => x.name === d.server)
    if (!s) return NextResponse.json({ error: "Nie ma takiego serwera." }, { status: 404 })
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
      return NextResponse.json(
        { error: `Nie udało się połączyć: ${String(e).slice(0, 160)}` },
        { status: 502 },
      )
    }
  }

  if (d.action === "zatwierdz") {
    const servers = await folder.fullCatalogue()
    const s = servers.find((x) => x.name === d.server)
    if (!s) return NextResponse.json({ error: "Nie ma takiego serwera." }, { status: 404 })
    if (!d.description?.trim() || !d.shortLabel?.trim()) {
      return NextResponse.json(
        { error: "Opis i krótka nazwa są wymagane — pisze je człowiek, nie serwer." },
        { status: 400 },
      )
    }
    if (!capabilityCatalogue.some((z) => z.id === d.capability)) {
      return NextResponse.json({ error: "Nieznana zdolność." }, { status: 400 })
    }

    // Odcisk liczymy z ŻYWEGO schematu w chwili zgody, nie z tego, co przysłała przeglądarka.
    // Inaczej zatwierdzający podpisywałby coś, czego serwer już nie wystawia.
    const candidates = await inspectServer(s.url, s.name)
    const k = candidates.find((x) => x.remoteName === d.remoteName)
    if (!k)
      return NextResponse.json(
        { error: "Serwer nie wystawia już tego narzędzia." },
        { status: 409 },
      )
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

  if (d.action === "wycofaj") {
    await folder.withdrawTool(u.id, d.server, d.remoteName)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Nieznana akcja." }, { status: 400 })
}
