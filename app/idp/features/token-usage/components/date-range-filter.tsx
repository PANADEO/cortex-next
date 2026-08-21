"use client"

import { MAX_RANGE_DAYS, parseDateRange } from "@/lib/token-usage/range"
import { Button, Input, Label } from "@cortex/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PRESETS } from "../presets"
import type { UsageDateRange } from "../types"

interface DateRangeFilterProps {
  value: UsageDateRange
  onChange: (range: UsageDateRange) => void
  isLoading?: boolean
}

/**
 * Natywny `<Input type="date">` zamiast kalendarza: `@cortex/ui` nie ma
 * komponentu kalendarza, a natywny daje dokładnie tę samą semantykę co
 * `st.date_input` z oryginału przy zerowym koszcie i z darmową obsługą
 * klawiatury oraz lokalizacji systemowej.
 *
 * Walidacja idzie przez TĘ SAMĄ funkcję, której używa route (`parseDateRange`) —
 * jedno źródło prawdy dla reguły, dwa miejsca wywołania. Klient dostaje
 * natychmiastowy komunikat, serwer i tak sprawdza wszystko ponownie, bo
 * blokada w formularzu nie zatrzymuje żądania wysłanego curlem.
 */
export function DateRangeFilter({ value, onChange, isLoading }: DateRangeFilterProps) {
  const { t } = useTranslation("token-usage")
  const [draft, setDraft] = useState<UsageDateRange>(value)

  const parsed = parseDateRange(draft.start, draft.end)
  const isDirty = draft.start !== value.start || draft.end !== value.end

  function applyPreset(build: (today: Date) => UsageDateRange) {
    const range = build(new Date())
    setDraft(range)
    onChange(range)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="token-usage-start">{t("filter.startLabel")}</Label>
          <Input
            id="token-usage-start"
            type="date"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="token-usage-end">{t("filter.endLabel")}</Label>
          <Input
            id="token-usage-end"
            type="date"
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
            className="w-44"
          />
        </div>
        <Button
          onClick={() => parsed.ok && onChange(parsed.range)}
          disabled={!parsed.ok || !isDirty || isLoading}
        >
          {t("filter.submit")}
        </Button>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.build)}
              disabled={isLoading}
            >
              {t(`filter.presets.${preset.id}`, { defaultValue: preset.label })}
            </Button>
          ))}
        </div>
      </div>

      {parsed.ok ? (
        // Etykieta mówi o strefie PROXY, nie przeglądarki — tam daty są
        // parsowane i tam `end` jest inkluzywny. Bez tego liczby wyglądałyby
        // na przesunięte o dzień dla kogoś w innej strefie.
        <p className="text-xs text-muted-foreground">
          {t("filter.hint", { days: MAX_RANGE_DAYS })}
        </p>
      ) : (
        // `parseDateRange` niesie własny komunikat po polsku (lib/, jeszcze
        // nieprzetłumaczona) — bierzemy z niego tylko KOD i tłumaczymy go tym
        // samym słownikiem, którym ekran opisuje błędy z route'a.
        <p className="text-xs text-destructive">{t(`errors.${parsed.code}.message`)}</p>
      )}
    </div>
  )
}
