import type { ErrorCode, ErrorResponse } from "@cortex/types"
import i18next from "i18next"

export class ApiError extends Error {
  readonly status: number
  readonly errorCode: ErrorCode | null
  readonly variables: Record<string, string>
  /**
   * Full parsed error response body, verbatim. `message`/`errorCode`/`variables`
   * cover the common shape; some endpoints attach extra structured fields
   * (e.g. a list of the specific invalid values that failed validation) that
   * a caller may want to render beyond the plain message. Undefined when the
   * body wasn't valid JSON.
   */
  readonly details: unknown
  /**
   * Zdanie dla UŻYTKOWNIKA, jeśli serwer je przysłał — inaczej `null`.
   *
   * Rozdzielone od `message` celowo. `message` musi być zawsze niepuste, bo
   * idzie do logów i do `Error.stack`, więc spada na `response.statusText`.
   * Ale `statusText` to fraza protokołu HTTP: po HTTP/1.1 Node wypełnia ją
   * zawsze, jest po angielsku i nie da się jej przetłumaczyć. Dopóki obie
   * role dzieliły jedno pole, trasa zwracająca sam KOD błędu pokazywała
   * użytkownikowi „Bad Request".
   */
  readonly userMessage: string | null

  constructor(params: {
    status: number
    message: string
    errorCode?: ErrorCode | null
    variables?: Record<string, string>
    details?: unknown
    userMessage?: string | null
  }) {
    super(params.message)
    this.name = "ApiError"
    this.status = params.status
    this.errorCode = params.errorCode ?? null
    this.variables = params.variables ?? {}
    this.details = params.details
    this.userMessage = params.userMessage ?? null
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: ErrorResponse | { detail?: unknown } | null = null
    try {
      body = (await response.json()) as ErrorResponse
    } catch {
      body = null
    }

    const errorResponse = body as Partial<ErrorResponse> | null
    return new ApiError({
      status: response.status,
      message: errorResponse?.message ?? response.statusText ?? "Request failed",
      errorCode: errorResponse?.error_code ?? null,
      variables: errorResponse?.variables ?? {},
      details: body ?? undefined,
      userMessage: errorResponse?.message ?? null,
    })
  }
}

/** Kody błędów trzymają KLUCZ z przestrzeni `common`, nie gotowe zdanie:
 *  katalog jest stałą modułu, więc napis zamroziłby się na języku startowym. */
const ERROR_MESSAGE_KEYS: Record<ErrorCode, string> = {
  PACKAGE_DUPLICATE: "errors.packageDuplicate",
  PACKAGE_NOT_FOUND: "errors.packageNotFound",
  FILE_NOT_FOUND: "errors.fileNotFound",
  INVALID_PACKAGE_FILE: "errors.invalidPackageFile",
  TRANSITION_NOT_ALLOWED: "errors.transitionNotAllowed",
  RESULT_NOT_FOUND: "errors.resultNotFound",
  ENTITY_NOT_FOUND: "errors.entityNotFound",
  CSV_EXPORT_VALIDATION_FAILED: "errors.csvExportValidationFailed",
  PERMISSION_DENIED: "errors.permissionDenied",
  EMAIL_DELIVERY_NOT_CONFIGURED: "errors.emailDeliveryNotConfigured",
  EMAIL_DELIVERY_FAILED: "errors.emailDeliveryFailed",
}

/** Napis w języku wybranym w tej chwili. Ten pakiet zna WYŁĄCZNIE bibliotekę
 *  i nazwę przestrzeni — nigdy aplikacji; instancję stawia host. */
export function translateErrorKey(key: string, fallback: string): string {
  return i18next.t(key, { ns: "common", defaultValue: fallback })
}

export function errorCodeToMessage(code: ErrorCode | null, fallback?: string): string {
  const generic = fallback ?? translateErrorKey("errors.generic", "Something went wrong")
  if (!code) return generic
  const key = ERROR_MESSAGE_KEYS[code]
  return key ? translateErrorKey(key, generic) : generic
}
