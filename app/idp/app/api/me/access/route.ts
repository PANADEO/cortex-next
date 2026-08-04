// Bramka POWŁOKI: co ten użytkownik widzi w hubie i przez które kafelki
// przechodzi AppGate. Źródłem jest WYŁĄCZNIE własny Postgres (system_config)
// przez @cortex/service — nie ma już HTTP do zewnętrznego cortex-admin i nie
// ma fallbacku na niego (świadoma decyzja: dwa źródła prawdy w bramce
// fail-closed to dokładnie ten mechanizm, przez który "zapomniana"
// konfiguracja daje inne uprawnienia niż pokazuje UI).
//
// CORTEX_ADMIN_API_BASE_URL / CORTEX_ADMIN_API_KEY / CORTEX_APP_CODE zostały
// USUNIĘTE (30.07.2026) razem z tym HTTP-fallbackiem. Ustawienie ich dziś nie
// ma żadnego efektu — nie przywracaj ich "na wszelki wypadek". CORTEX_APP_CODE
// był martwy już wcześniej.
//
// SECURITY: handler ufa nagłówkowi `x-auth-request-email`. MUSI stać za
// oauth2-proxy / Caddy `forward_auth`, które usuwają wartość podaną przez
// klienta i wstrzykują uwierzytelniony adres. Wystawienie tej trasy wprost do
// internetu pozwoliłoby podszyć się pod dowolną tożsamość jednym nagłówkiem.
//
// KONTRAKT (celowo niezmieniony — AppGate na nim polega):
//   200 { allowed, apps, email } — także przy odmowie i przy awarii bazy.
//   401 { error } — wyłącznie gdy nie da się ustalić tożsamości.
// Odmowa NIE jest 4xx: `AppGate` rozróżnia "nie masz dostępu" (denied) od
// "bramka się wywaliła" (error) po treści, a nie po kodzie HTTP. Zamiana na
// 403 przeniosłaby usera na inny ekran dla tego samego stanu.
import { getRequestEmail } from "@cortex/service"
import type { AuthorizedAppsResponse } from "@cortex/api"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { grantedAppCodes } from "../../_lib/granted-apps"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = getRequestEmail(request.headers)

  if (!email) {
    return NextResponse.json({ error: "missing-email" }, { status: 401 })
  }

  const apps = await grantedAppCodes(email)

  return NextResponse.json({
    allowed: apps.length > 0,
    apps,
    email,
  } satisfies AuthorizedAppsResponse)
}
