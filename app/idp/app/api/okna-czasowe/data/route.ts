import { store } from "@/lib/okna-czasowe/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed } from "../_lib/guard"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const snapshots = await store.listSnapshots()
  return NextResponse.json(snapshots)
}
