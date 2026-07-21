import { store } from "@/lib/okna-czasowe/store"
import { NextResponse } from "next/server"

export async function GET(): Promise<NextResponse> {
  const log = await store.listLog()
  return NextResponse.json(log)
}
