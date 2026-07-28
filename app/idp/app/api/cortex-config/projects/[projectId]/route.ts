import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { deleteProject, upsertProject } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { findInvalidGrantReferences, parseProjectBody } from "../validation"

interface RouteContext {
  params: Promise<{ projectId: string }>
}

function notFound(projectId: string): NextResponse {
  return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { projectId } = await context.params
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  const project = gate.config.projects.find((candidate) => candidate.id === projectId)
  if (!project) return notFound(projectId)
  return NextResponse.json(project)
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { projectId } = await context.params
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  if (!gate.config.projects.some((candidate) => candidate.id === projectId)) {
    return notFound(projectId)
  }

  const parsed = parseProjectBody(await request.json().catch(() => null))
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }
  if (parsed.value.id !== projectId) {
    return NextResponse.json({ message: "Project id cannot be changed" }, { status: 400 })
  }
  const invalidReferences = await findInvalidGrantReferences(parsed.value.composition, gate.config)
  if (invalidReferences.length > 0) {
    return NextResponse.json(
      { message: "composition grants reference unknown catalog resources", invalidReferences },
      { status: 400 },
    )
  }

  const project = await upsertProject(parsed.value, gate.config)
  return NextResponse.json(project)
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { projectId } = await context.params
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  const deleted = await deleteProject(projectId, gate.config)
  if (!deleted) return notFound(projectId)
  return NextResponse.json({ ok: true })
}
