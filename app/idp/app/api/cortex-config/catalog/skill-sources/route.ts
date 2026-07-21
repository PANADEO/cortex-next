import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { saveGovernanceConfig } from "@/lib/cortex-governance/store"
import type { CoworkSkillSource } from "@cortex/types"
import { COWORK_DEPARTMENT_PATTERN, COWORK_SLUG_PATTERN } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

function invalidReason(source: unknown): string | undefined {
  if (typeof source !== "object" || source === null) return "source must be an object"
  const s = source as CoworkSkillSource
  if (!s.id || !COWORK_SLUG_PATTERN.test(s.id)) return "id must be a slug"
  if (!s.name || typeof s.name !== "string") return "name is required"
  if (!s.folderPath || typeof s.folderPath !== "string" || !s.folderPath.startsWith("/")) {
    return "folderPath must be an absolute path"
  }
  if (!s.department || !COWORK_DEPARTMENT_PATTERN.test(s.department)) {
    return "department must be a department path"
  }
  return undefined
}

/** Replaces the whole skill-sources list. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate

  const body = (await request.json().catch(() => null)) as { sources?: unknown } | null
  if (!Array.isArray(body?.sources)) {
    return NextResponse.json({ message: "sources must be an array" }, { status: 400 })
  }
  for (const source of body.sources) {
    const reason = invalidReason(source)
    if (reason) return NextResponse.json({ message: reason }, { status: 400 })
  }

  gate.config.skillSources = body.sources as CoworkSkillSource[]
  await saveGovernanceConfig(gate.config)
  return NextResponse.json({ skillSources: gate.config.skillSources })
}
