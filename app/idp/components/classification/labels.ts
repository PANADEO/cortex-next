import type { DirtyPackageStatus, DocMode, DocType } from "@cortex/types"

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice: "Invoice",
  packing_list: "Packing list",
  translation_sheet: "Translation",
  code_assignment: "Code table",
  bill_of_lading: "Bill of lading",
  certificate_of_origin: "Cert. of origin",
  correspondence: "Correspondence",
  other: "Other",
  skip: "Skip",
}

export const DOC_MODE_LABEL: Record<DocMode, string> = {
  process: "Process (LLM)",
  pass_through: "Pass-through",
  skip: "Skip",
}

export const DOC_MODE_COLOR: Record<DocMode, string> = {
  process: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  pass_through: "border-sky-500/40 text-sky-700 bg-sky-500/10",
  skip: "border-muted-foreground/30 text-muted-foreground bg-muted",
}

export const DIRTY_STATUS_LABEL: Record<DirtyPackageStatus, string> = {
  needs_classification: "Needs classification",
  classifying: "Classifying",
  classified: "Classified",
  promoted: "Promoted",
  archived: "Archived",
}
