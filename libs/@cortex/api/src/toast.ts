import { toast } from "sonner"
import { ApiError, errorCodeToMessage } from "./error"

export function toastApiError(error: unknown, fallback = "Something went wrong"): void {
  if (error instanceof ApiError) {
    toast.error(error.message || errorCodeToMessage(error.errorCode, fallback))
    return
  }
  if (error instanceof Error) {
    toast.error(error.message || fallback)
    return
  }
  toast.error(fallback)
}
