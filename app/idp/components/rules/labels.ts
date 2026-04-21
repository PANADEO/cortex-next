import type { RuleCategory, RuleStatus, RuleTrigger } from "@cortex/types"

export const RULE_CATEGORY_LABEL: Record<RuleCategory, string> = {
  transport_allocation: "Transport allocation",
  aggregation: "Aggregation",
  split: "Split",
  lookup: "Lookup",
  currency: "Currency",
  tax: "Tax",
  weight_derivation: "Weight derivation",
  custom: "Custom",
}

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
}

export const RULE_STATUS_TONE: Record<RuleStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  archived: "border-border text-muted-foreground",
}

export const RULE_TRIGGER_LABEL: Record<RuleTrigger, string> = {
  manual: "Manual",
  auto_on_extraction: "Auto on extraction",
}

export function hasMeaningfulNl(nl: string): boolean {
  return nl.trim().length >= 8
}
