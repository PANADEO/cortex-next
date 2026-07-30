"use client"

import { MAX_RANGE_DAYS, parseDateRange } from "@/lib/token-usage/range"
import { Button, Input, Label } from "@cortex/ui"
import { useState } from "react"
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
          <Label htmlFor="token-usage-start">Data początkowa</Label>
          <Input
            id="token-usage-start"
            type="date"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="token-usage-end">Data końcowa</Label>
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
          Pokaż raport
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
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {parsed.ok ? (
        // Etykieta mówi o strefie PROXY, nie przeglądarki — tam daty są
        // parsowane i tam `end` jest inkluzywny. Bez tego liczby wyglądałyby
        // na przesunięte o dzień dla kogoś w innej strefie.
        <p className="text-xs text-muted-foreground">
          Zakres obejmuje obie daty włącznie, liczony w strefie cortex-proxy
          (Europe/Warsaw, CET/CEST). Maksymalna długość zakresu: {MAX_RANGE_DAYS} dni.
        </p>
      ) : (
        <p className="text-xs text-destructive">{parsed.message}</p>
      )}
    </div>
  )
}
