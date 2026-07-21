import type { CoworkGovernanceConfig } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requestEmail } from "./request-identity"
import { isAdmin, readGovernanceConfig } from "./store"

export interface AdminContext {
  config: CoworkGovernanceConfig
  email: string | undefined
}

/**
 * The one admin gate for every /api/cortex-config handler. Returns the loaded
 * config + requester identity on success (so handlers don't re-read the
 * document), or a ready 403 response. Any change to gate semantics (audit
 * log, identity source) happens here and nowhere else.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const config = await readGovernanceConfig()
  const email = requestEmail(request)
  if (!isAdmin(config, email)) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  return { config, email }
}

export function isDenied(result: AdminContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
