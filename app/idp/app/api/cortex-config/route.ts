import { requestEmail } from "@/lib/cortex-governance/request-identity"
import { isAdmin, readGovernanceConfig } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/** Full governance document for the cortex-config admin tile. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  const email = requestEmail(request)
  if (!isAdmin(config, email)) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 })
  }
  return NextResponse.json(config)
}
