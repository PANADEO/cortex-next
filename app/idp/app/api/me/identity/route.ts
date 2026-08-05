// Tożsamość POWŁOKI: kto jest zalogowany. Źródłem jest nagłówek wstrzyknięty
// przez oauth2-proxy (e-mail) + własny Postgres (nazwa wyświetlana) — DOKŁADNIE
// to samo źródło, z którego siostrzane /api/me/access czyta uprawnienia.
// Domknięcie kierunku z 30.07.2026, w którym powłoka przestała pytać zewnętrzny
// backend o to, co wie sama.
//
// Powód powstania: powłoka brała "kim jestem" z `GET /user/me`, które middleware
// przepisuje na IDP_BACKEND_URL (domyślnie http://idp-app). Na cortex-next tego
// kontenera NIE MA i nie będzie (osobne repo, własny Postgres i RabbitMQ,
// świadomie niewdrażane), więc menu użytkownika pokazywało "—" mimo poprawnego
// uwierzytelnienia.
//
// ZAKRES — czego ta trasa CELOWO nie zwraca: `has_access` i `scopes` z
// /user/me. To pojęcia backendu IDP (m.in. `package_unlock` → badge
// "IDP admin"), których własny Postgres nie zna; udawanie ich tutaj rozjechało
// by demo-dev, gdzie tamten backend stoi i realnie je wystawia. Powłoka bierze
// stąd TOŻSAMOŚĆ, a scope'y nadal z /user/me — patrz useShellUser()
// w @cortex/api.
//
// SECURITY: handler ufa nagłówkowi `x-auth-request-email`, tak samo i z tym
// samym wymogiem co /api/me/access — MUSI stać za oauth2-proxy / Caddy
// `forward_auth`, które usuwają wartość podaną przez klienta i wstrzykują
// uwierzytelniony adres.
//
// KONTRAKT:
//   200 { email, name } — `name` null, gdy użytkownika nie ma w
//                         system_config.users albo nie ma full_name.
//   401 { error }       — wyłącznie gdy nie da się ustalić tożsamości.
// Awaria bazy NIE jest błędem tej trasy: e-mail pochodzi z uwierzytelnionego
// nagłówka i jest znany niezależnie od Postgresa, więc degradujemy do
// { email, name: null } + log serwerowy, zamiast gasić menu użytkownika przez
// brak opcjonalnej ozdoby. To nie jest bramka — o dostępie rozstrzyga
// fail-closed /api/me/access, więc awaria bazy i tak jest dla użytkownika
// widoczna (odmowa), nie ukryta.
import { getRequestEmail, getUserDisplayName } from "@cortex/service"
import type { UserIdentityResponse } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = getRequestEmail(request.headers)

  if (!email) {
    return NextResponse.json({ error: "missing-email" }, { status: 401 })
  }

  return NextResponse.json({
    email,
    name: await displayName(email),
  } satisfies UserIdentityResponse)
}

async function displayName(email: string): Promise<string | null> {
  try {
    return await getUserDisplayName(email)
  } catch (error) {
    console.error("[api] tożsamość bez nazwy — błąd odczytu z bazy:", error)
    return null
  }
}
