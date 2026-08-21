import { toast } from "sonner"
import { ApiError, errorCodeToMessage, translateErrorKey } from "./error"

/**
 * `fallback` jest opcjonalny, a nie zaszyty po angielsku: wołający, który go
 * nie poda, ma dostać zapas w języku użytkownika, nie „Something went wrong".
 *
 * Dla `ApiError` czytamy `userMessage`, nie `message` — to pierwsze jest
 * zdaniem, które serwer naprawdę skierował do użytkownika, drugie spada na
 * frazę protokołu HTTP i pokazywało „Bad Request" wszędzie tam, gdzie trasa
 * zwraca sam kod błędu.
 */
export function toastApiError(error: unknown, fallback?: string): void {
  const generic = fallback ?? translateErrorKey("errors.generic", "Something went wrong")
  if (error instanceof ApiError) {
    toast.error(error.userMessage || errorCodeToMessage(error.errorCode, generic))
    return
  }
  if (error instanceof Error) {
    toast.error(error.message || generic)
    return
  }
  toast.error(generic)
}
