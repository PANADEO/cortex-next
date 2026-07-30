import { runScan } from "@/lib/okna-czasowe/scan"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed } from "../_lib/guard"

// Najdroższy handler modułu: wypuszcza z serwera ruch WYCHODZĄCY do publicznego
// API JustWatch. Bramka musi wyprzedzić runScan(), inaczej anonimowe żądanie
// nadal generowałoby obciążenie po stronie zewnętrznego serwisu w imieniu tej
// instalacji — nawet gdyby odpowiedź kończyła się na 403.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const result = await runScan()
  return NextResponse.json(result)
}
