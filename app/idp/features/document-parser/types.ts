// Kontrakt klient<->BFF. Kształt odpowiada temu, co zwraca
// @cortex/db JobRow (jobs.serialize przez NextResponse.json) — daty
// docierają jako stringi ISO po stronie JSON, nie jako obiekty Date.

export type JobStatus = "queued" | "processing" | "done" | "error"

export type JobErrorCode =
  | "unsupported-format"
  | "file-too-large"
  | "conversion-failed"
  | "vision-call-failed"
  | "page-limit-exceeded"

export interface DocumentParserJob {
  id: string
  backendJobId: string | null
  userEmail: string
  status: JobStatus
  fileName: string
  fileSizeBytes: number
  mimeType: string
  model: string | null
  markdown: string | null
  errorMessage: string | null
  errorCode: JobErrorCode | null
  pageCount: number
  imageCount: number
  truncated: boolean
  elapsedSeconds: number | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface CreateJobResponse {
  jobId: string
  status: JobStatus
}
