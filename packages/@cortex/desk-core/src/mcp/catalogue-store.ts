import "server-only"
import * as audit from "../audit-log"
import { migrate, pool } from "../db"
import { VAT_REGISTRY_TOOLS, type ApprovedTool, type McpServer } from "./catalogue"

/**
 * KATALOG W BAZIE, nie w kodzie.
 *
 * Do kroku 6 lista zatwierdzonych narzędzi stała w pliku źródłowym. To działało, dopóki
 * zatwierdzającym byłem ja — ale zgoda na narzędzie ma należeć do przełożonego i mieć jego
 * nazwisko, datę i możliwość wycofania bez wdrożenia nowej wersji aplikacji.
 */

export type CatalogueTool = ApprovedTool & {
  status: "approved" | "suspended"
  reason: string | null
  approvedBy: string
  at: string
}

export type CatalogueServer = Omit<McpServer, "tools"> & {
  addedBy: string
  tools: CatalogueTool[]
}

const toCatalogueTool = (r: Record<string, unknown>): CatalogueTool => ({
  // Wiersz z `pg` przychodzi bez typu — rzutujemy przy odczycie POLA, nie na całym wierszu,
  // żeby literówka w nazwie kolumny dalej dawała `undefined`, a nie cichy `any`.
  server: r.server as string,
  remoteName: r.remote_name as string,
  description: r.description as string,
  shortLabel: r.short_label as string,
  capabilityId: r.capability as string,
  fingerprint: r.fingerprint as string,
  status: r.status as CatalogueTool["status"],
  reason: r.reason as string,
  approvedBy: r.approved_by as string,
  at: r.at as string,
})

/**
 * Pierwsze uruchomienie przenosi to, co dotąd stało w kodzie, do bazy — raz, i tylko gdy
 * baza jest pusta. Bez tego wdrożenie tej wersji odebrałoby Annie zdolność, którą już ma.
 */
export async function seedCatalogue() {
  await migrate()
  const url = process.env.MCP_VAT_REGISTRY_URL
  if (!url) return
  const exists = await pool.query(`select 1 from desk.mcp_server where name='vat-registry'`)
  if (exists.rowCount) return

  await pool.query(
    `insert into desk.mcp_server (name, label, url, added_by) values ($1,$2,$3,$4)
     on conflict (name) do nothing`,
    ["vat-registry", "wykaz podatników VAT", url, "seed"],
  )
  for (const n of VAT_REGISTRY_TOOLS) {
    await pool.query(
      `insert into desk.mcp_tool (server, remote_name, description, short_label, capability, fingerprint, approved_by)
       values ($1,$2,$3,$4,$5,$6,'seed') on conflict do nothing`,
      [n.server, n.remoteName, n.description, n.shortLabel, n.capabilityId, n.fingerprint],
    )
  }
}

/** To, co naprawdę wolno zarejestrować w rejestrze modelu: wyłącznie stan „zatwierdzone". */
export async function serverCatalogue(): Promise<McpServer[]> {
  await seedCatalogue()
  const s = await pool.query(`select * from desk.mcp_server order by name`)
  const n = await pool.query(
    `select * from desk.mcp_tool where status='approved' order by remote_name`,
  )
  return s.rows
    .map((x) => ({
      name: x.name,
      label: x.label,
      url: x.url,
      tools: n.rows.filter((y) => y.server === x.name).map(toCatalogueTool) as ApprovedTool[],
    }))
    .filter((x) => x.tools.length > 0)
}

/** Widok dla przełożonego — razem z wstrzymanymi, bo to o nich musi się dowiedzieć. */
export async function fullCatalogue(): Promise<CatalogueServer[]> {
  await seedCatalogue()
  const s = await pool.query(`select * from desk.mcp_server order by name`)
  const n = await pool.query(`select * from desk.mcp_tool order by remote_name`)
  return s.rows.map((x) => ({
    name: x.name,
    label: x.label,
    url: x.url,
    addedBy: x.added_by,
    tools: n.rows.filter((y) => y.server === x.name).map(toCatalogueTool),
  }))
}

export async function addServer(who: string, name: string, label: string, url: string) {
  await migrate()
  await pool.query(
    `insert into desk.mcp_server (name, label, url, added_by) values ($1,$2,$3,$4)
     on conflict (name) do update set label=excluded.label, url=excluded.url`,
    [name, label, url, who],
  )
  await audit.write(who, "mcp.server.added", { name, url })
}

export async function approveTool(who: string, n: ApprovedTool) {
  await migrate()
  await pool.query(
    `insert into desk.mcp_tool (server, remote_name, description, short_label, capability, fingerprint, status, reason, approved_by, at)
     values ($1,$2,$3,$4,$5,$6,'approved',null,$7,now())
     on conflict (server, remote_name) do update set
       description=excluded.description, short_label=excluded.short_label, capability=excluded.capability,
       fingerprint=excluded.fingerprint, status='approved', reason=null,
       approved_by=excluded.approved_by, at=now()`,
    [n.server, n.remoteName, n.description, n.shortLabel, n.capabilityId, n.fingerprint, who],
  )
  await audit.write(who, "mcp.tool.approved", {
    server: n.server,
    tool: n.remoteName,
    capability: n.capabilityId,
    fingerprint: n.fingerprint,
  })
}

export async function withdrawTool(who: string, server: string, remoteName: string) {
  await migrate()
  await pool.query(`delete from desk.mcp_tool where server=$1 and remote_name=$2`, [
    server,
    remoteName,
  ])
  await audit.write(who, "mcp.tool.withdrawn", { server, tool: remoteName })
}

/**
 * Dryf: serwer zmienił narzędzie po zatwierdzeniu. Wstrzymujemy je fail-closed — nie
 * zarejestruje się do czasu, aż człowiek obejrzy różnicę i zatwierdzi ponownie.
 * Nie kasujemy wpisu, bo to zatarłoby ślad, że zgoda w ogóle istniała.
 */
export async function suspendTool(server: string, remoteName: string, reason: string) {
  await migrate()
  const r = await pool.query(
    `update desk.mcp_tool set status='suspended', reason=$3
     where server=$1 and remote_name=$2 and status<>'suspended'`,
    [server, remoteName, reason],
  )
  if (r.rowCount)
    await audit.write("system", "mcp.tool.suspended", {
      server,
      tool: remoteName,
      reason,
    })
}
