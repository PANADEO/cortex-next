import type { RuleCategory, RuleStatus, RuleTrigger } from "@cortex/types"

// Stałe trzymają KLUCZE przestrzeni `idp`, nie napisy — ten plik nie jest
// komponentem i nie ma własnego `t()`. Napis powstaje w miejscu renderu.

export const RULE_CATEGORY_LABEL_KEY: Record<RuleCategory, string> = {
  transport_allocation: "rules.categories.transport_allocation",
  aggregation: "rules.categories.aggregation",
  split: "rules.categories.split",
  lookup: "rules.categories.lookup",
  currency: "rules.categories.currency",
  tax: "rules.categories.tax",
  weight_derivation: "rules.categories.weight_derivation",
  custom: "rules.categories.custom",
}

export const RULE_STATUS_LABEL_KEY: Record<RuleStatus, string> = {
  draft: "rules.statuses.draft",
  active: "rules.statuses.active",
  archived: "rules.statuses.archived",
}

export const RULE_STATUS_TONE: Record<RuleStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  archived: "border-border text-muted-foreground",
}

export const RULE_TRIGGER_LABEL_KEY: Record<RuleTrigger, string> = {
  manual: "rules.triggers.manual",
  auto_on_extraction: "rules.triggers.auto_on_extraction",
}

export function hasMeaningfulNl(nl: string): boolean {
  return nl.trim().length >= 8
}
