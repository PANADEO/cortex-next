import { store } from "@/lib/okna-czasowe/store"
import { NextResponse } from "next/server"

export async function GET(): Promise<NextResponse> {
  const snapshots = await store.listSnapshots()
  return NextResponse.json(snapshots)
}
