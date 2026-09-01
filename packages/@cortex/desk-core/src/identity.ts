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
  return (await identity()).user
}

/**
 * Kto pyta i CZY DA SIĘ TO ZMIENIĆ. Powłoka pokazuje przełącznik person tylko
 * wtedy, gdy przełącznik naprawdę działa — inaczej menu wybiera osobę, tożsamość
 * zostaje stara i wygląda to na awarię Biurka, a jest konfiguracją.
 */
export async function identity(): Promise<{ user: User; switchable: boolean }> {
  const h = await headers()

  // 1. Prawdziwa tożsamość z bramy logowania. Zawsze wygrywa i nigdy nie da się
  //    jej podmienić ciasteczkiem — to jest ta granica, która trzyma produkcję.
  const fromGate = normalise(h.get("x-auth-request-email"))
  if (fromGate) return { user: bySeedEmail(fromGate), switchable: false }

  // 2. Atrapa DEMO. Stoi PRZED `DEV_USER_EMAIL`, bo oba są mechanizmami dewa,
  //    a ten jest bardziej szczegółowy: wybór person jest jawnym kliknięciem
  //    człowieka, a zmienna środowiskowa tylko tłem, na którym on wybiera.
  if (DEMO_PERSONAS) {
    const c = await cookies()
    const id = c.get("desk_persona")?.value ?? "anna"
    const selected = USERS.find((u) => u.id === id) ?? USERS[0]
    // Pusty zasiew person to błąd wdrożenia, nie stan do obsłużenia po cichu.
    if (!selected) throw new Error("Zasiew użytkowników jest pusty — nie ma kogo podstawić.")
    return { user: selected, switchable: true }
  }

  // 3. Tożsamość dewa bez atrapy person — tak wstaje powłoka bez bramy logowania.
  const fromEnv = normalise(process.env.DEV_USER_EMAIL)
  if (fromEnv) return { user: bySeedEmail(fromEnv), switchable: false }

  // Fail-closed i głośno. Cicha podmiana na pierwszego z listy dawała komuś
  // cudze biurko i cudze zdolności, nie zostawiając po sobie ani jednego wpisu.
  throw new Error("Brak tożsamości — żądanie nie przeszło przez bramę logowania.")
}

/**
 * Adres → osoba z zasiewu.
 *
 * Zasiew person nosi same identyfikatory, więc adres trzeba złożyć — a domena
 * jest własnością WDROŻENIA, nie kodu. Wpisana na sztywno („itsg.pl") znaczyła,
 * że pod powłoką u klienta nie zalogowałby się nikt: bramka podaje prawdziwy
 * adres, a tu czekało dopasowanie do cudzej domeny.
 */
function bySeedEmail(email: string): User {
  const u = USERS.find((x) => `${x.id}@${DOMAIN}` === email)
  if (u) return u
  throw new Error(`Nie znam użytkownika ${email}.`)
}
