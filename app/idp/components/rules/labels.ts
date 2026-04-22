import type { RuleCategory, RuleStatus, RuleTrigger } from "@cortex/types"

export const RULE_CATEGORY_LABEL: Record<RuleCategory, string> = {
  transport_allocation: "Alokacja transportu",
  aggregation: "Agregacja",
  split: "Podział",
  lookup: "Słownik",
  currency: "Waluta",
  tax: "Podatek",
  weight_derivation: "Wyliczanie wagi",
  custom: "Niestandardowa",
}

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  draft: "Szkic",
  active: "Aktywna",
  archived: "Archiwalna",
}

export const RULE_STATUS_TONE: Record<RuleStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  archived: "border-border text-muted-foreground",
}

export const RULE_TRIGGER_LABEL: Record<RuleTrigger, string> = {
  manual: "Ręcznie",
  auto_on_extraction: "Auto przy ekstrakcji",
}

export function hasMeaningfulNl(nl: string): boolean {
  return nl.trim().length >= 8
}
