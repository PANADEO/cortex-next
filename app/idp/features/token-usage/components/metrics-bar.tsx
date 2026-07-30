"use client"

import { DataCard } from "@cortex/ui"
import { Activity, Boxes, Brain, Layers, Send, Users } from "lucide-react"
import { formatNumber } from "../format"
import type { UsageTotals } from "../types"

/**
 * Pasek metryk — odpowiednik zakładki "Statystyki" z oryginału, plus tokeny
 * rozumowania, których tamten w ogóle nie pokazywał.
 */
export function MetricsBar({ totals }: { totals: UsageTotals }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <DataCard
        label="Tokeny łącznie"
        value={formatNumber(totals.totalTokens)}
        description={`${formatNumber(totals.requestTokens)} w żądaniach, ${formatNumber(totals.responseTokens)} w odpowiedziach`}
        icon={Layers}
      />
      <DataCard
        label="Liczba żądań"
        value={formatNumber(totals.requestCount)}
        // Nieudane żądania liczą się do request_count, ale mają zera w tokenach
        // (proxy.go:463-465, 498-500) — bez tej noty średnia wygląda na błąd.
        description="Wliczając żądania nieudane, które nie zużyły tokenów"
        icon={Send}
      />
      <DataCard
        label="Aktywni użytkownicy"
        value={formatNumber(totals.activeUsers)}
        description={
          totals.userCount > totals.activeUsers
            ? `${formatNumber(totals.userCount)} widocznych, w tym bez zużycia`
            : "Z niezerowym zużyciem tokenów"
        }
        icon={Users}
      />
      <DataCard
        label="Średnia na użytkownika"
        value={formatNumber(totals.averageTokensPerActiveUser)}
        description="Liczona po aktywnych użytkownikach"
        icon={Activity}
      />
      <DataCard
        label="Tokeny rozumowania"
        value={formatNumber(totals.reasoningTokens)}
        description="Raportowane osobno przez modele reasoningowe"
        icon={Brain}
      />
      <DataCard
        label="Tokeny z cache"
        value={formatNumber(totals.cachedTokens)}
        description="Część żądań obsłużona z pamięci podręcznej dostawcy"
        icon={Boxes}
      />
      <DataCard
        label="Modele"
        value={formatNumber(totals.modelCount)}
        description={totals.topModel ? `Najczęstszy: ${totals.topModel}` : "Brak danych"}
        icon={Boxes}
      />
      <DataCard
        label="Aplikacje"
        value={formatNumber(totals.appCount)}
        description={totals.topApp ? `Najczęstsza: ${totals.topApp}` : "Brak danych"}
        icon={Layers}
      />
    </div>
  )
}
