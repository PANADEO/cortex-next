import { requestEmail } from "@/lib/cortex-governance/request-identity"
import {
  isAdmin,
  readGovernanceConfig,
  saveGovernanceConfig,
} from "@/lib/cortex-governance/store"
import type { CoworkRole, CoworkSkillGroup } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

interface GovernanceUpdateBody {
  skillGroups?: CoworkSkillGroup[]
  roles?: CoworkRole[]
  userAssignments?: Record<string, string[]>
  adminEmails?: string[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function invalidReason(body: GovernanceUpdateBody): string | undefined {
  if (body.skillGroups !== undefined) {
    if (!Array.isArray(body.skillGroups)) return "skillGroups must be an array"
    for (const group of body.skillGroups) {
      if (!group.id || !group.name || !isStringArray(group.skillIds)) {
        return "each skill group needs id, name and skillIds[]"
      }
    }
  }
  if (body.roles !== undefined) {
    if (!Array.isArray(body.roles)) return "roles must be an array"
    for (const role of body.roles) {
      if (!role.id || !role.name || !isStringArray(role.skillGroupIds)) {
        return "each role needs id, name and skillGroupIds[]"
      }
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
  return undefined
}

/** Partial update of the central governance sections (not projects). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  const email = requestEmail(request)
  if (!isAdmin(config, email)) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as GovernanceUpdateBody | null
  if (!body) return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  const reason = invalidReason(body)
  if (reason) return NextResponse.json({ message: reason }, { status: 400 })

  if (body.skillGroups !== undefined) config.skillGroups = body.skillGroups
  if (body.roles !== undefined) config.roles = body.roles
  if (body.userAssignments !== undefined) {
    config.userAssignments = Object.fromEntries(
      Object.entries(body.userAssignments).map(([key, value]) => [key.toLowerCase(), value]),
    )
  }
  if (body.adminEmails !== undefined) config.adminEmails = body.adminEmails

  await saveGovernanceConfig(config)
  return NextResponse.json(config)
}
