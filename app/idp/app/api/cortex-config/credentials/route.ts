import {
  deleteCredential,
  isValidCredentialPath,
  listCredentialPaths,
  setCredential,
} from "@/lib/cortex-governance/credentials"
import { requestEmail } from "@/lib/cortex-governance/request-identity"
import { isAdmin, readGovernanceConfig } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

async function adminGate(request: NextRequest): Promise<NextResponse | null> {
  const config = await readGovernanceConfig()
  if (!isAdmin(config, requestEmail(request))) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  return null
}

/** Paths only. Secret values are write-only through this API. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await adminGate(request)
  if (denied) return denied
  return NextResponse.json({ paths: await listCredentialPaths() })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const denied = await adminGate(request)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as {
    path?: string
    value?: string
  } | null
  if (!body?.path || typeof body.value !== "string" || body.value.length === 0) {
    return NextResponse.json({ message: "path and value are required" }, { status: 400 })
  }
  if (!isValidCredentialPath(body.path)) {
    return NextResponse.json(
      { message: "path must be key/subkey (lowercase slugs separated by /)" },
      { status: 400 },
    )
  }
  await setCredential(body.path, body.value)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const denied = await adminGate(request)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as { path?: string } | null
  if (!body?.path) {
    return NextResponse.json({ message: "path is required" }, { status: 400 })
  }
  const deleted = await deleteCredential(body.path)
  if (!deleted) {
    return NextResponse.json({ message: `Unknown credential: ${body.path}` }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
