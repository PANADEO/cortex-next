import { requestEmail } from "@/lib/cortex-governance/request-identity"
import {
  isAdmin,
  readGovernanceConfig,
  upsertProject,
} from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { parseProjectBody } from "./validation"

/** Admin list: every project, including disabled ones. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  if (!isAdmin(config, requestEmail(request))) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  return NextResponse.json(config.projects)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  if (!isAdmin(config, requestEmail(request))) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }

  const parsed = parseProjectBody(await request.json().catch(() => null))
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }
  if (config.projects.some((project) => project.id === parsed.value.id)) {
    return NextResponse.json(
      { message: `Project already exists: ${parsed.value.id}` },
      { status: 409 },
    )
  }

  const project = await upsertProject(parsed.value)
  return NextResponse.json(project, { status: 201 })
}
