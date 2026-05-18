import type { ErrorCode, ErrorResponse } from "@cortex/types"

export class ApiError extends Error {
  readonly status: number
  readonly errorCode: ErrorCode | null
  readonly variables: Record<string, string>

  constructor(params: {
    status: number
    message: string
    errorCode?: ErrorCode | null
    variables?: Record<string, string>
  }) {
    super(params.message)
    this.name = "ApiError"
    this.status = params.status
    this.errorCode = params.errorCode ?? null
    this.variables = params.variables ?? {}
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
    })
  }
}

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  PACKAGE_DUPLICATE: "This package has already been imported.",
  PACKAGE_NOT_FOUND: "Package not found.",
  FILE_NOT_FOUND: "Source file not found.",
  INVALID_PACKAGE_FILE: "Package file is invalid or corrupted.",
  TRANSITION_NOT_ALLOWED: "This action is not allowed in the current state.",
  RESULT_NOT_FOUND: "Result not available yet.",
  ENTITY_NOT_FOUND: "Entity not found.",
  CSV_EXPORT_VALIDATION_FAILED: "CSV export failed validation. Fix the highlighted issues and retry.",
  PERMISSION_DENIED: "You do not have permission to perform this action.",
}

export function errorCodeToMessage(code: ErrorCode | null, fallback = "Unexpected error"): string {
  if (!code) return fallback
  return ERROR_MESSAGES[code] ?? fallback
}
