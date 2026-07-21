import { runScan } from "@/lib/okna-czasowe/scan"
import { NextResponse } from "next/server"

export async function POST(): Promise<NextResponse> {
  const result = await runScan()
  return NextResponse.json(result)
}
