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

// Odpowiedzi błędu niosą KOD, nie zdanie: serwer nie zna języka użytkownika
// (wybór siedzi w localStorage przeglądarki). Limit długości dodatkowo podaje
// klucz komunikatu i jego parametr - wartość limitu zna wyłącznie serwer
// (user-instructions.ts sięga po node:path, więc nie da się jej zaimportować
// na kliencie), wzorem lib/document-parser/constraints.ts.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = requestEmail(request)
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  return NextResponse.json({ instructions: (await readUserInstructions(email)) ?? "" })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const email = requestEmail(request)
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { instructions?: unknown } | null
  if (!body || typeof body.instructions !== "string") {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }
  if (body.instructions.length > USER_INSTRUCTIONS_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: "instructions-too-long",
        messageKey: "sidebar.instructionsTooLong",
        messageParams: { max: USER_INSTRUCTIONS_MAX_LENGTH },
      },
      { status: 400 },
    )
  }

  await setUserInstructions(email, body.instructions)
  return NextResponse.json({ instructions: body.instructions.trim() })
}
