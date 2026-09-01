import { cookies, headers } from "next/headers"
import usersJson from "../seed/users.json"
import type { User } from "./types"

export const USERS = usersJson.users as User[]

/** Kanoniczna postać adresu — dokładnie jak `normalizeEmail` w `@cortex/service/src/rbac.ts`. */
const normalise = (v: string | null | undefined) => v?.trim().toLowerCase() ?? ""

/** Domena, w której żyją osoby z zasiewu. Zmienia się między wdrożeniami, kod nie. */
const DOMAIN = (process.env.DESK_DOMAIN ?? "itsg.pl").trim().toLowerCase()

/**
 * Przełącznik person jest atrapą DEMO i musi być włączony jawnie.
 *
 * Ciasteczko `desk_persona` jest ustawiane bez `httpOnly`, więc jedna linia
 * `document.cookie` wystarczała, żeby stać się Robertem — a rola `zarzad` ma w
 * `seed/zdolnosci.json` zdolność `kod.uruchom`, której piaskownica nie zamyka ani
 * na sieci, ani na pamięci. To nie była różnica w wygodzie logowania, tylko droga
 * do wykonania kodu. Domyślnie wyłączone: konfiguracja wdrożeniowa tej zmiennej
 * nie definiuje, więc u klienta ciasteczko nie znaczy nic.
 */
const DEMO_PERSONAS = process.env.DESK_DEMO_PERSONAS === "1"

/**
 * W produkcji tożsamość wchodzi WYŁĄCZNIE nagłówkiem od oauth2-proxy, który
 * musi obcinać ten nagłówek przychodzący od klienta. Pusty nagłówek to BRAK
 * tożsamości, nigdy tożsamość pustego adresu.
 *
 * Semantyka celowo powtarza `getRequestEmail` z `@cortex/service` — sama funkcja
 * przyjdzie tu przy przeprowadzce do `app/idp`, bo dziś ten pakiet ciągnąłby za
 * sobą drizzle i całą warstwę bazy powłoki.
 */
export async function whoAmI(): Promise<User> {
  const h = await headers()
  const email = normalise(h.get("x-auth-request-email") ?? process.env.DEV_USER_EMAIL)
  if (email) {
    // Zasiew person nosi same identyfikatory, więc adres trzeba złożyć — a domena
    // jest własnością WDROŻENIA, nie kodu. Wpisana na sztywno („itsg.pl") znaczyła,
    // że pod powłoką u klienta nie zalogowałby się nikt: bramka podaje prawdziwy
    // adres, a tu czekało dopasowanie do cudzej domeny.
    const u = USERS.find((x) => `${x.id}@${DOMAIN}` === email)
    if (u) return u
    throw new Error(`Nie znam użytkownika ${email}.`)
  }

  if (DEMO_PERSONAS) {
    const c = await cookies()
    const id = c.get("desk_persona")?.value ?? "anna"
    const selected = USERS.find((u) => u.id === id) ?? USERS[0]
    // Pusty zasiew person to błąd wdrożenia, nie stan do obsłużenia po cichu.
    if (!selected) throw new Error("Zasiew użytkowników jest pusty — nie ma kogo podstawić.")
    return selected
  }

  // Fail-closed i głośno. Cicha podmiana na pierwszego z listy dawała komuś
  // cudze biurko i cudze zdolności, nie zostawiając po sobie ani jednego wpisu.
  throw new Error("Brak tożsamości — żądanie nie przeszło przez bramę logowania.")
}
