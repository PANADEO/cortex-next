import type { ErrorCode } from "./enums"

export interface ErrorResponse {
  error_code: ErrorCode
  message: string
  variables?: Record<string, string>
}

export interface ValidationErrorItem {
  loc: Array<string | number>
  msg: string
  type: string
}

export interface HTTPValidationError {
  detail?: ValidationErrorItem[]
}
