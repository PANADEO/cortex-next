import { requestEmail } from "@/lib/cortex-governance/request-identity"
import {
  deleteProject,
  isAdmin,
  readGovernanceConfig,
  upsertProject,
} from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { parseProjectBody } from "../validation"

interface RouteContext {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { projectId } = await context.params
  const config = await readGovernanceConfig()
  if (!isAdmin(config, requestEmail(request))) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  const project = config.projects.find((candidate) => candidate.id === projectId)
  if (!project) {
    return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
  }
  return NextResponse.json(project)
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { projectId } = await context.params
  const config = await readGovernanceConfig()
  if (!isAdmin(config, requestEmail(request))) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  if (!config.projects.some((candidate) => candidate.id === projectId)) {
    return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
  }

  const parsed = parseProjectBody(await request.json().catch(() => null))
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }
  if (parsed.value.id !== projectId) {
    return NextResponse.json({ message: "Project id cannot be changed" }, { status: 400 })
  }

  const project = await upsertProject(parsed.value)
  return NextResponse.json(project)
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { projectId } = await context.params
  const config = await readGovernanceConfig()
  if (!isAdmin(config, requestEmail(request))) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  const deleted = await deleteProject(projectId)
  if (!deleted) {
    return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
