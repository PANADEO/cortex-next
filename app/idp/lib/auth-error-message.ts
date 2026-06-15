"use client"

type SearchParamsReader = Pick<URLSearchParams, "get">

const MESSAGE_PARAMS = ["error_description", "error_message", "message", "reason"] as const

function normalizeMessage(value: string | null): string | null {
  const message = value?.trim()
  if (!message) return null
  return message.length > 300 ? `${message.slice(0, 300).trim()}...` : message
}

export function getAuthErrorMessage(searchParams: SearchParamsReader): string | null {
  for (const param of MESSAGE_PARAMS) {
    const message = normalizeMessage(searchParams.get(param))
    if (message) return message
  }

  const error = normalizeMessage(searchParams.get("error"))
  if (!error) return null

  return error === "access_denied" ? "Nie udało się zalogować." : error
}
