import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/** Full governance document for the cortex-config admin tile. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  return NextResponse.json(gate.config)
}
