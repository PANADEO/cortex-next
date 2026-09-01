import { createHash } from "node:crypto"
import capabilitiesJson from "../seed/capabilities.json"
import { migrate, pool } from "./db"
import type { Capability, Policy, Role, User } from "./types"

const CATALOGUE = capabilitiesJson.capabilities as Capability[]
const ROLES = capabilitiesJson.roles as Record<Role, string[]>
const LIMITS = capabilitiesJson.limits as Record<Role, { usdPerDay: number }>

export const capabilityCatalogue = CATALOGUE

/**
 * F1 · BRAMA ZDOLNOŚCI — jedyna warstwa, której nikt nam nie sprzeda.
 *
 * Zestaw powstaje z dwóch źródeł: z roli (plik seed) oraz z indywidualnych nadań
 * w tabeli `desk.grant`. Kontrakt się nie zmienia: resolve(user) → zmaterializowany zestaw,
 * a odcisk obejmuje OBA źródła, więc nadanie zmienia zakres widoczny w dzienniku.
 */
export async function policyFor(u: User): Promise<Policy> {
  await migrate()
  const g = await pool.query<{ capability: string }>(
    `select capability from desk.grant where who=$1`,
    [u.id],
  )
  const granted = g.rows.map((r) => r.capability)
  return build(u, granted)
}

/** Wariant bez bazy — do miejsc, które nie mogą czekać, oraz do testów bramy. */
export function policyFromRole(u: User): Policy {
  return build(u, [])
}

function build(u: User, extraGrants: string[]): Policy {
  const known = new Set(CATALOGUE.map((z) => z.id))
  const grantedIds = new Set([...(ROLES[u.role] ?? []), ...extraGrants.filter((z) => known.has(z))])
  const granted = CATALOGUE.filter((z) => grantedIds.has(z.id))
  const blocked = CATALOGUE.filter((z) => !grantedIds.has(z.id))
  const fingerprint = createHash("sha256")
    .update(`${u.id}|${u.role}|${[...grantedIds].sort().join(",")}`)
    .digest("hex")
    .slice(0, 12)
  return {
    user: u.id,
    role: u.role,
    granted,
    blocked,
    dailyLimitUsd: LIMITS[u.role]?.usdPerDay ?? 1,
    fingerprint,
  }
}

export function hasCapability(p: Policy, id: string) {
  return p.granted.some((z) => z.id === id)
}

export async function spentToday(user: string): Promise<number> {
  await migrate()
  const r = await pool.query<{ total: string }>(
    `select coalesce(sum(cost_usd),0)::text as total from desk.case_file
     where owner=$1 and updated_at::date = now()::date`,
    [user],
  )
  return Number(r.rows[0]?.total ?? 0)
}
