import { cookies, headers } from 'next/headers'
import uzytkownicyJson from '../seed/uzytkownicy.json'
import type { Uzytkownik } from './typy'

export const UZYTKOWNICY = uzytkownicyJson.uzytkownicy as Uzytkownik[]

/** Kanoniczna postać adresu — dokładnie jak `normalizeEmail` w `@cortex/service/src/rbac.ts`. */
const normalizuj = (v: string | null | undefined) => v?.trim().toLowerCase() ?? ''

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
const DEMO_PERSONY = process.env.DESK_DEMO_PERSONY === '1'

/**
 * W produkcji tożsamość wchodzi WYŁĄCZNIE nagłówkiem od oauth2-proxy, który
 * musi obcinać ten nagłówek przychodzący od klienta. Pusty nagłówek to BRAK
 * tożsamości, nigdy tożsamość pustego adresu.
 *
 * Semantyka celowo powtarza `getRequestEmail` z `@cortex/service` — sama funkcja
 * przyjdzie tu przy przeprowadzce do `app/idp`, bo dziś ten pakiet ciągnąłby za
 * sobą drizzle i całą warstwę bazy powłoki.
 */
export async function ktoTo(): Promise<Uzytkownik> {
  const h = await headers()
  const email = normalizuj(h.get('x-auth-request-email') ?? process.env.DEV_USER_EMAIL)
  if (email) {
    const u = UZYTKOWNICY.find((x) => `${x.id}@itsg.pl` === email)
    if (u) return u
    throw new Error(`Nie znam użytkownika ${email}.`)
  }

  if (DEMO_PERSONY) {
    const c = await cookies()
    const id = c.get('desk_persona')?.value ?? 'anna'
    const wybrany = UZYTKOWNICY.find((u) => u.id === id) ?? UZYTKOWNICY[0]
    // Pusty zasiew person to błąd wdrożenia, nie stan do obsłużenia po cichu.
    if (!wybrany) throw new Error('Zasiew użytkowników jest pusty — nie ma kogo podstawić.')
    return wybrany
  }

  // Fail-closed i głośno. Cicha podmiana na pierwszego z listy dawała komuś
  // cudze biurko i cudze zdolności, nie zostawiając po sobie ani jednego wpisu.
  throw new Error('Brak tożsamości — żądanie nie przeszło przez bramę logowania.')
}
