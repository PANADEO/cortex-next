// BFF raportu zużycia tokenów: parse -> auth -> config -> adapter -> agregacja.
// Kontroler zostaje cienki (code-api) — cała arytmetyka siedzi w czystych
// funkcjach w lib/token-usage/.
//
// DLACZEGO AGREGUJEMY TUTAJ, A NIE W PRZEGLĄDARCE — trzy powody, każdy wystarczy:
//  1. Sekret ADMIN_API_KEY nie ma prawa opuścić serwera, więc przeglądarka
//     nigdy nie rozmawia z cortex-proxy bezpośrednio.
//  2. Surowa odpowiedź /usage niesie e-maile wszystkich użytkowników i nazwy
//     wewnętrznych integracji — do klienta idzie gotowy model widoku.
//  3. Grupowanie to czysta funkcja, testowalna bez Reacta, jsdom-a i sieci.

import { buildUsageReport } from "@/lib/token-usage/aggregate"
import { tokenUsageConfig } from "@/lib/token-usage/config"
import { parseDateRange } from "@/lib/token-usage/range"
import { fetchProxyUsage } from "@cortex/api/cortex-proxy-client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, toUsageErrorResponse } from "./_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const params = new URL(request.url).searchParams
  const range = parseDateRange(params.get("start"), params.get("end"))
  if (!range.ok) {
    return NextResponse.json({ error: range.code, message: range.message }, { status: 400 })
  }

  // Konfiguracja czytana LENIWIE (safeParse), nie przy imporcie modułu —
  // brak sekretu ma wyłączyć ten jeden endpoint, nie całą aplikację.
  const config = tokenUsageConfig()
  if (!config.ok) {
    console.error("[token-usage] brak konfiguracji:", config.missing.join(", "))
    return NextResponse.json(
      {
        error: "cortex-proxy-not-configured",
        message: `Brak konfiguracji: ${config.missing.join(", ")}.`,
        missing: config.missing,
      },
      { status: 503 },
    )
  }

  try {
    const rows = await fetchProxyUsage({
      baseUrl: config.config.baseUrl,
      adminApiKey: config.config.adminApiKey,
      start: range.range.start,
      end: range.range.end,
    })

    // Odpowiedź niesie PII (kto, ile, czym) — żaden pośrednik nie ma prawa
    // trzymać jej kopii, nawet przez chwilę.
    return NextResponse.json(
      { range: range.range, ...buildUsageReport(rows) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    return toUsageErrorResponse(error)
  }
}
