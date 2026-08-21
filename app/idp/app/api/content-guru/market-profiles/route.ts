// GET/POST /api/content-guru/market-profiles — mirror client-profiles/route.ts,
// PER-USER (D7), zero dodatkowego scope'u (D9).

import {
  createMarketProfile,
  listMyMarketProfiles,
  marketProfileInputSchema,
} from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { isUniqueViolation, requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  return NextResponse.json(await listMyMarketProfiles(gate.email))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const parsed = marketProfileInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  try {
    const created = await createMarketProfile(gate.email, parsed.data)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd tworzenia profilu rynku:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
