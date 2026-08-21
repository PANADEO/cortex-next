"use client"

import { SOURCE_LOCALE } from "@/lib/i18n/config"
import { useTranslation } from "react-i18next"
import type { AiToolDefinition } from "./registry"

/**
 * Nazwa i opis narzędzia w języku interfejsu.
 *
 * Napisy NIE żyją w przestrzeni `ai-tools`, tylko w `tiles` — bo to te same
 * teksty, które hub bierze z bazy (`applications.name/description`), a
 * `registry.ts` niesie wyłącznie ich wartość POCZĄTKOWĄ dla manifestu.
 * Dublowanie ich tutaj dałoby dwa źródła prawdy i kafelek nazwany inaczej na
 * hubie niż w nagłówku własnej strony.
 *
 * W języku ŹRÓDŁOWYM wygrywa rejestr — dokładnie tak samo jak w
 * `components/shell/hub/hub-tile.ts`, i z tego samego powodu: w `pl` nie ma
 * pliku `tiles.json`, więc `t()` spadłoby na zapas angielski i pokazało
 * Polakowi angielską nazwę.
 */
export function useAiToolText(tool: AiToolDefinition): {
  label: string
  description: string
} {
  const { i18n, t } = useTranslation("tiles")

  if (i18n.language === SOURCE_LOCALE) {
    return { label: tool.label, description: tool.description }
  }

  return {
    label: t(`${tool.id}.label`, { defaultValue: tool.label }),
    description: t(`${tool.id}.description`, { defaultValue: tool.description }),
  }
}
