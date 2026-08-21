import type { DirtyPackageStatus, DocMode, DocType } from "@cortex/types"

// Stałe trzymają KLUCZE przestrzeni `idp`, nie napisy — ten plik nie jest
// komponentem i nie ma własnego `t()`. Napis powstaje w miejscu renderu.

export const DOC_TYPE_LABEL_KEY: Record<DocType, string> = {
  invoice: "classification.docType.invoice",
  packing_list: "classification.docType.packing_list",
  translation_sheet: "classification.docType.translation_sheet",
  code_assignment: "classification.docType.code_assignment",
  bill_of_lading: "classification.docType.bill_of_lading",
  certificate_of_origin: "classification.docType.certificate_of_origin",
  correspondence: "classification.docType.correspondence",
  other: "classification.docType.other",
  skip: "classification.docType.skip",
}

export const DOC_MODE_LABEL_KEY: Record<DocMode, string> = {
  process: "classification.docMode.process",
  pass_through: "classification.docMode.pass_through",
  skip: "classification.docMode.skip",
}

export const DOC_MODE_COLOR: Record<DocMode, string> = {
  process: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  pass_through: "border-sky-500/40 text-sky-700 bg-sky-500/10",
  skip: "border-muted-foreground/30 text-muted-foreground bg-muted",
}

export const DIRTY_STATUS_LABEL_KEY: Record<DirtyPackageStatus, string> = {
  needs_classification: "classification.dirtyStatus.needs_classification",
  classifying: "classification.dirtyStatus.classifying",
  classified: "classification.dirtyStatus.classified",
  promoted: "classification.dirtyStatus.promoted",
  archived: "classification.dirtyStatus.archived",
}
