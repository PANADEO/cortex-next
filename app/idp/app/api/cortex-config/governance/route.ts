import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { saveGovernanceConfig } from "@/lib/cortex-governance/store"
import type { CoworkAgentsInstructions, CoworkRole } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { isStringArray } from "../projects/validation"

interface GovernanceUpdateBody {
  roles?: CoworkRole[]
  userAssignments?: Record<string, string[]>
  adminEmails?: string[]
  agentsInstructions?: CoworkAgentsInstructions
}

function invalidReason(body: GovernanceUpdateBody): string | undefined {
  if (body.roles !== undefined) {
    if (!Array.isArray(body.roles)) return "roles must be an array"
    for (const role of body.roles) {
      if (!role.id || !role.name) return "each role needs id and name"
    }
  }
  if (body.userAssignments !== undefined) {
    if (typeof body.userAssignments !== "object" || body.userAssignments === null) {
      return "userAssignments must be an object"
    }
    for (const roleIds of Object.values(body.userAssignments)) {
      if (!isStringArray(roleIds)) return "userAssignments values must be string arrays"
    }
  }
  if (body.adminEmails !== undefined && !isStringArray(body.adminEmails)) {
    return "adminEmails must be a string array"
  }
  if (body.agentsInstructions !== undefined) {
    const instructions = body.agentsInstructions
    if (typeof instructions !== "object" || instructions === null) {
      return "agentsInstructions must be an object"
    }
    if (instructions.global !== undefined && typeof instructions.global !== "string") {
      return "agentsInstructions.global must be a string"
    }
    if (
      typeof instructions.departments !== "object" ||
      instructions.departments === null ||
      Object.values(instructions.departments).some((value) => typeof value !== "string")
    ) {
      return "agentsInstructions.departments must map department paths to strings"
    }
  }
  return undefined
}

/** Partial update of the central governance sections (not projects). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  const { config } = gate

  const body = (await request.json().catch(() => null)) as GovernanceUpdateBody | null
  if (!body) return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  const reason = invalidReason(body)
  if (reason) return NextResponse.json({ message: reason }, { status: 400 })

  if (body.roles !== undefined) config.roles = body.roles
  // Emails are stored lowercase (assignment keys AND admin list) so store
  // lookups never depend on the caller's casing.
  if (body.userAssignments !== undefined) {
    config.userAssignments = Object.fromEntries(
      Object.entries(body.userAssignments).map(([key, value]) => [key.toLowerCase(), value]),
    )
  }
  if (body.adminEmails !== undefined) {
    config.adminEmails = body.adminEmails.map((email) => email.toLowerCase())
  }
  if (body.agentsInstructions !== undefined) {
    // Drop empty layers so the stored document stays minimal.
    const departments = Object.fromEntries(
      Object.entries(body.agentsInstructions.departments)
        .map(([dept, text]) => [dept, text.trim()])
        .filter(([, text]) => text),
    )
    const global = body.agentsInstructions.global?.trim()
    config.agentsInstructions = { ...(global ? { global } : {}), departments }
  }

  await saveGovernanceConfig(config)
  return NextResponse.json(config)
}
