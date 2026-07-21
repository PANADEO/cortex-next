import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { saveGovernanceConfig } from "@/lib/cortex-governance/store"
import type { CoworkConnectorConfig } from "@cortex/types"
import { COWORK_DEPARTMENT_PATTERN } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

function invalidReason(connector: unknown): string | undefined {
  if (typeof connector !== "object" || connector === null) return "connector must be an object"
  const c = connector as CoworkConnectorConfig
  if (!c.id || typeof c.id !== "string") return "id is required"
  if (c.type !== "mcp" && c.type !== "cli") return "type must be mcp or cli"
  if (!c.name || typeof c.name !== "string") return "name is required"
  if (typeof c.enabled !== "boolean") return "enabled must be a boolean"
  if (!c.target || typeof c.target !== "string") return "target is required"
  if (!c.department || !COWORK_DEPARTMENT_PATTERN.test(c.department)) {
    return "department must be a department path"
  }
  return undefined
}

/** Replaces the whole connector catalog. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate

  const body = (await request.json().catch(() => null)) as { connectors?: unknown } | null
  if (!Array.isArray(body?.connectors)) {
    return NextResponse.json({ message: "connectors must be an array" }, { status: 400 })
  }
  for (const connector of body.connectors) {
    const reason = invalidReason(connector)
    if (reason) return NextResponse.json({ message: reason }, { status: 400 })
  }

  gate.config.connectors = body.connectors as CoworkConnectorConfig[]
  await saveGovernanceConfig(gate.config)
  return NextResponse.json({ connectors: gate.config.connectors })
}
