"use client"

import { DataCard } from "@cortex/ui"
import { Activity, Boxes, Brain, Layers, Send, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatNumber } from "../format"
import type { UsageTotals } from "../types"

/**
 * Pasek metryk — odpowiednik zakładki "Statystyki" z oryginału, plus tokeny
 * rozumowania, których tamten w ogóle nie pokazywał.
 */
export function MetricsBar({ totals }: { totals: UsageTotals }) {
  const { t } = useTranslation(["token-usage", "common"])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <DataCard
        label={t("metrics.totalTokens.label")}
        value={formatNumber(totals.totalTokens)}
        description={t("metrics.totalTokens.description", {
          request: formatNumber(totals.requestTokens),
          response: formatNumber(totals.responseTokens),
        })}
        icon={Layers}
      />
      <DataCard
        label={t("metrics.requestCount.label")}
        value={formatNumber(totals.requestCount)}
        // Nieudane żądania liczą się do request_count, ale mają zera w tokenach
        // (proxy.go:463-465, 498-500) — bez tej noty średnia wygląda na błąd.
        description={t("metrics.requestCount.description")}
        icon={Send}
      />
      <DataCard
        label={t("metrics.activeUsers.label")}
        value={formatNumber(totals.activeUsers)}
        description={
          totals.userCount > totals.activeUsers
            ? t("metrics.activeUsers.withIdle", { total: formatNumber(totals.userCount) })
            : t("metrics.activeUsers.description")
        }
        icon={Users}
      />
      <DataCard
        label={t("metrics.averagePerUser.label")}
        value={formatNumber(totals.averageTokensPerActiveUser)}
        description={t("metrics.averagePerUser.description")}
        icon={Activity}
      />
      <DataCard
        label={t("metrics.reasoningTokens.label")}
        value={formatNumber(totals.reasoningTokens)}
        description={t("metrics.reasoningTokens.description")}
        icon={Brain}
      />
      <DataCard
        label={t("metrics.cachedTokens.label")}
        value={formatNumber(totals.cachedTokens)}
        description={t("metrics.cachedTokens.description")}
        icon={Boxes}
      />
      <DataCard
        label={t("metrics.models.label")}
        value={formatNumber(totals.modelCount)}
        description={
          totals.topModel
            ? t("metrics.models.top", { model: totals.topModel })
            : t("common:state.empty")
        }
        icon={Boxes}
      />
      <DataCard
        label={t("metrics.apps.label")}
        value={formatNumber(totals.appCount)}
        description={
          totals.topApp ? t("metrics.apps.top", { app: totals.topApp }) : t("common:state.empty")
        }
        icon={Layers}
      />
    </div>
  )
}
