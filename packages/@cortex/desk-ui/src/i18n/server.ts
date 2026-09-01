import { cookies } from "next/headers"
import "server-only"
import {
  DEFAULT_DESK_LOCALE,
  DESK_LOCALE_COOKIE,
  isDeskLocale,
  makeDeskT,
  type DeskLocale,
  type DeskT,
} from "./locale"

/** Język tego żądania. Ciasteczko, bo tylko ono dojeżdża do renderu na serwerze. */
export async function deskLocale(): Promise<DeskLocale> {
  const chosen = (await cookies()).get(DESK_LOCALE_COOKIE)?.value
  return isDeskLocale(chosen) ? chosen : DEFAULT_DESK_LOCALE
}

/** Tłumaczenie w komponencie serwerowym: `const t = await deskT()`. */
export async function deskT(): Promise<DeskT> {
  return makeDeskT(await deskLocale())
}
