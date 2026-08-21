"use client"

import { Input, Label } from "@cortex/ui"
import { useTranslation } from "react-i18next"

interface Props {
  idPrefix: string
  from: string
  to: string
  onChange: (next: { from: string; to: string }) => void
}

export function DateRangeFilter({ idPrefix, from, to, onChange }: Props) {
  const { t } = useTranslation("common")
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label
          htmlFor={`${idPrefix}-from`}
          className="text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {t("fields.from")}
        </Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className="h-9 w-[160px]"
        />
      </div>
      <div className="space-y-1">
        <Label
          htmlFor={`${idPrefix}-to`}
          className="text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {t("fields.to")}
        </Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="h-9 w-[160px]"
        />
      </div>
    </div>
  )
}
