"use client"

import i18n from "@/lib/i18n"

type SearchParamsReader = Pick<URLSearchParams, "get">

/** Napis w języku wybranym w tej chwili. Domyślnie z jedynej instancji
 *  i18next — funkcja jest czysta i bywa wołana spoza Reacta (tak jak
 *  `breadcrumbsFromPath` w `lib/breadcrumbs.ts`); komponent podaje własne `t`,
 *  żeby komunikat przeliczył się przy zmianie języka. */
type Translate = (key: string) => string

const translateWithSharedInstance: Translate = (key) => i18n.t(key, { ns: "shell" })

const MESSAGE_PARAMS = ["error_description", "error_message", "message", "reason"] as const

function normalizeMessage(value: string | null): string | null {
  const message = value?.trim()
  if (!message) return null
  return message.length > 300 ? `${message.slice(0, 300).trim()}...` : message
}

export function getAuthErrorMessage(
  searchParams: SearchParamsReader,
  t: Translate = translateWithSharedInstance,
): string | null {
  for (const param of MESSAGE_PARAMS) {
    const message = normalizeMessage(searchParams.get(param))
    if (message) return message
  }

  const error = normalizeMessage(searchParams.get("error"))
  if (!error) return null

  // Pozostałe kody błędu idą na ekran surowe — pochodzą od dostawcy tożsamości,
  // nie z tego repo, więc nie ma czego tłumaczyć.
  return error === "access_denied" ? t("landing.accessDenied") : error
}
