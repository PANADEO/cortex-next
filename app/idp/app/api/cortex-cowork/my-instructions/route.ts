import { requestEmail } from "@/lib/cortex-governance/request-identity"
import {
  readUserInstructions,
  setUserInstructions,
  USER_INSTRUCTIONS_MAX_LENGTH,
} from "@/lib/cortex-governance/user-instructions"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// Self-service endpoint for the user layer of AGENTS.md ("Moje instrukcje").
// Identity comes from the oauth2-proxy header - each user can only read and
// write their own note.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = requestEmail(request)
  if (!email) return NextResponse.json({ message: "Brak tożsamości użytkownika" }, { status: 401 })
  return NextResponse.json({ instructions: (await readUserInstructions(email)) ?? "" })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const email = requestEmail(request)
  if (!email) return NextResponse.json({ message: "Brak tożsamości użytkownika" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { instructions?: unknown } | null
  if (!body || typeof body.instructions !== "string") {
    return NextResponse.json({ message: "instructions (string) is required" }, { status: 400 })
  }
  if (body.instructions.length > USER_INSTRUCTIONS_MAX_LENGTH) {
    return NextResponse.json(
      { message: `Maksymalnie ${USER_INSTRUCTIONS_MAX_LENGTH} znaków` },
      { status: 400 },
    )
  }

  await setUserInstructions(email, body.instructions)
  return NextResponse.json({ instructions: body.instructions.trim() })
}
