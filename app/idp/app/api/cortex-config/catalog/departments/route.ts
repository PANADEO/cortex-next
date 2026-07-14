import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { saveGovernanceConfig } from "@/lib/cortex-governance/store"
import { COWORK_DEPARTMENT_PATTERN } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/** Replaces the explicit department list (paths). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate

  const body = (await request.json().catch(() => null)) as { departments?: string[] } | null
  if (!Array.isArray(body?.departments)) {
    return NextResponse.json({ message: "departments must be a string array" }, { status: 400 })
  }
  for (const dept of body.departments) {
    if (typeof dept !== "string" || !COWORK_DEPARTMENT_PATTERN.test(dept)) {
      return NextResponse.json(
        { message: `invalid department path: ${String(dept)}` },
        { status: 400 },
      )
    }
  }

  gate.config.departments = [...new Set(body.departments)].sort()
  await saveGovernanceConfig(gate.config)
  return NextResponse.json({ departments: gate.config.departments })
}
