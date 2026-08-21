// Zdanie dla użytkownika z odpowiedzi błędu trasy BFF.
//
// Trasy nie zwracają gotowych zdań: serwer nie zna języka użytkownika (wybór
// siedzi w localStorage przeglądarki), więc odpowiedź niesie KOD, a tam gdzie
// sam kod nie wystarcza — także `messageKey` i `messageParams`, wzorem
// lib/document-parser/constraints.ts. Napis powstaje dopiero tutaj.
//
// Dlaczego nie `toastApiError`: `ApiError.fromResponse` bierze `message` z
// `response.statusText`, kiedy ciało odpowiedzi go nie ma. Po HTTP/1.1 Node
// dopisuje tam standardową frazę statusu, więc użytkownik zobaczyłby
// angielskie „Bad Request" zamiast zapasu podanego przez wołającego.

import type { TOptions } from "i18next"

/** Kształt `t` z `useTranslation()` zawężony do jednego wywołania, którego ten
 *  moduł potrzebuje — bez tego `TFunction` dowolnej przestrzeni nie da się tu
 *  przekazać. */
type Translate = (key: string, options: TOptions & { defaultValue: string }) => string

/** Ciało odpowiedzi czytamy z `ApiError.details` po kształcie, a nie przez
 *  `instanceof`: import z `@cortex/api` wciągnąłby całą warstwę API do
 *  każdego testu komponentu, który ją mockuje. */
interface ErrorBody {
  messageKey?: unknown
  messageParams?: unknown
}

export function apiErrorMessage(t: Translate, error: unknown, fallback: string): string {
  const body = (error as { details?: ErrorBody } | null | undefined)?.details
  if (typeof body?.messageKey !== "string") return fallback
  const params = (body.messageParams ?? {}) as TOptions
  return t(body.messageKey, { ...params, defaultValue: fallback })
}
