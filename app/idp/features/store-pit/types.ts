import type {
  BREAKDOWNS,
  CHECKS,
  CLIENT_SUMMARY,
  EXTRACTION_ROWS,
  INVOICE_CHARGES,
  NETTING_ROWS,
  PIPELINE,
  SERVICE_SUMMARY,
} from "./dataset"

export type ExtractionRow = (typeof EXTRACTION_ROWS)[number]
export type CheckRow = (typeof CHECKS)[number]
export type ServiceRow = (typeof SERVICE_SUMMARY)[number]
export type ChargeRow = (typeof INVOICE_CHARGES)[number]
export type NettingRow = (typeof NETTING_ROWS)[number]
export type ClientSummaryRow = (typeof CLIENT_SUMMARY)[number]
export type PipelineStep = (typeof PIPELINE)[number]

export type ClientKey = keyof typeof BREAKDOWNS
export type ClientBreakdown = (typeof BREAKDOWNS)[ClientKey]
export type BreakdownRow = (typeof BREAKDOWNS)["Braintimizer"]["rows"][number]
export type ClientParcel = (typeof BREAKDOWNS)["Braintimizer"]["parcels"][number]

/** A processed run as shown on the audit log. Synthesised from the pipeline. */
export interface AuditEntry {
  step: string
  detail: string
  rows: number
  status: "ok" | "review"
  duration: string
  finishedAt: string
}
