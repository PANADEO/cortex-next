import {
  createSandboxSession,
  toCoworkSession,
} from "@/features/cortex-cowork/server/sandbox-store"
import { NextResponse } from "next/server"

export async function POST(): Promise<NextResponse> {
  try {
    const session = await createSandboxSession()
    return NextResponse.json(toCoworkSession(session), { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create sandbox session" },
      { status: 500 },
    )
  }
}
