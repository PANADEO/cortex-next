import { cookies, headers } from 'next/headers'
import uzytkownicyJson from '../../seed/uzytkownicy.json'
import type { Uzytkownik } from './typy'

export const UZYTKOWNICY = uzytkownicyJson.uzytkownicy as Uzytkownik[]

/**
 * W produkcji tożsamość wchodzi WYŁĄCZNIE nagłówkiem od oauth2-proxy.
 * W POC dopuszczamy przełącznik persony w ciasteczku — to jest atrapa za tym samym szwem.
 */
export async function ktoTo(): Promise<Uzytkownik> {
  const h = await headers()
  const zNaglowka = h.get('x-auth-request-email')
  if (zNaglowka) {
    const u = UZYTKOWNICY.find((x) => `${x.id}@itsg.pl` === zNaglowka)
    if (u) return u
  }
  const c = await cookies()
  const id = c.get('desk_persona')?.value ?? 'anna'
  return UZYTKOWNICY.find((u) => u.id === id) ?? UZYTKOWNICY[0]
}
