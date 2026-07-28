import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { upsertProject } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { findInvalidGrantReferences, parseProjectBody } from "./validation"

/** Admin list: every project, including disabled ones. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  return NextResponse.json(gate.config.projects)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate

  const parsed = parseProjectBody(await request.json().catch(() => null))
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }
  if (gate.config.projects.some((project) => project.id === parsed.value.id)) {
    return NextResponse.json(
      { message: `Project already exists: ${parsed.value.id}` },
      { status: 409 },
    )
  }
  const invalidReferences = await findInvalidGrantReferences(parsed.value.composition, gate.config)
  if (invalidReferences.length > 0) {
    return NextResponse.json(
      { message: "composition grants reference unknown catalog resources", invalidReferences },
      { status: 400 },
    )
  }

  const project = await upsertProject(parsed.value, gate.config)
  return NextResponse.json(project, { status: 201 })
}
