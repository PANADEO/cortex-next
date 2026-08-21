"use client"

import { DataQualityNote } from "@/features/token-usage/components/data-quality-note"
import { DateRangeFilter } from "@/features/token-usage/components/date-range-filter"
import { DetailTable } from "@/features/token-usage/components/detail-table"
import { DimensionPanel } from "@/features/token-usage/components/dimension-panel"
import { MetricsBar } from "@/features/token-usage/components/metrics-bar"
import { useTokenUsageReport } from "@/features/token-usage/hooks"
import { defaultRange } from "@/features/token-usage/presets"
import { readUsageErrorCode } from "@/features/token-usage/queries"
import type { UsageDateRange } from "@/features/token-usage/types"
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { Inbox } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function TokenUsagePage() {
  const { t } = useTranslation("token-usage")

  // Stan początkowy liczony raz (inicjalizator useState), nie przy każdym
  // renderze — inaczej obiekt zakresu byłby nowy za każdym razem i klucz
  // zapytania zmieniałby się w kółko.
  const [range, setRange] = useState<UsageDateRange>(() => defaultRange())
  const report = useTokenUsageReport(range)

  const errorCode = readUsageErrorCode(report.error)

  /**
   * Komunikaty rozróżniają BRAK KONFIGURACJI od AWARII — to nie kosmetyka:
   * pierwsze jest zadaniem dla administratora instancji i da się naprawić,
   * drugie oznacza, że cudzy serwis leży i trzeba czekać. Kod błędu jest
   * zarazem członem klucza tłumaczenia, więc słownik `errors` w przestrzeni
   * `token-usage` musi pokrywać cały `TokenUsageErrorCode`.
   */
  const copy = errorCode
    ? { title: t(`errors.${errorCode}.title`), message: t(`errors.${errorCode}.message`) }
    : null

  return (
    <>
      <PageHeader title={t("page.title")} description={t("page.description")} />

      <div className="space-y-6 p-6">
        <DateRangeFilter value={range} onChange={setRange} isLoading={report.isFetching} />
        <DataQualityNote />

        {report.isPending ? <LoadingState /> : null}

        {report.isError ? (
          <ErrorState
            title={copy?.title ?? t("errors.generic.title")}
            message={copy?.message ?? t("errors.generic.message")}
            // Brak konfiguracji nie naprawi się przez ponowienie — przycisk
            // "spróbuj ponownie" byłby tu obietnicą bez pokrycia.
            {...(errorCode === "cortex-proxy-not-configured"
              ? {}
              : { onRetry: () => void report.refetch() })}
          />
        ) : null}

        {report.data ? (
          report.data.totals.requestCount === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("empty.noDataTitle")}
              description={t("empty.noDataDescription")}
            />
          ) : (
            <div className="space-y-6">
              <MetricsBar totals={report.data.totals} />

              <Tabs defaultValue="users">
                <TabsList>
                  <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
                  <TabsTrigger value="models">{t("tabs.models")}</TabsTrigger>
                  <TabsTrigger value="apps">{t("tabs.apps")}</TabsTrigger>
                  <TabsTrigger value="scopes">{t("tabs.scopes")}</TabsTrigger>
                  <TabsTrigger value="details">{t("tabs.details")}</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="pt-4">
                  <DimensionPanel
                    title={t("panel.usersTitle")}
                    dimensionLabel={t("columns.user")}
                    groups={report.data.byUser}
                    range={report.data.range}
                    exportKind="uzytkownicy"
                    showUserCount={false}
                  />
                </TabsContent>

                <TabsContent value="models" className="pt-4">
                  <DimensionPanel
                    title={t("panel.modelsTitle")}
                    dimensionLabel={t("columns.model")}
                    groups={report.data.byModel}
                    range={report.data.range}
                    exportKind="modele"
                  />
                </TabsContent>

                <TabsContent value="apps" className="pt-4">
                  <DimensionPanel
                    title={t("panel.appsTitle")}
                    dimensionLabel={t("columns.app")}
                    groups={report.data.byApp}
                    range={report.data.range}
                    exportKind="aplikacje"
                  />
                </TabsContent>

                <TabsContent value="scopes" className="pt-4">
                  <DimensionPanel
                    title={t("panel.scopesTitle")}
                    dimensionLabel={t("columns.scope")}
                    groups={report.data.byScope}
                    range={report.data.range}
                    exportKind="zakresy"
                  />
                </TabsContent>

                <TabsContent value="details" className="pt-4">
                  <DetailTable report={report.data} range={report.data.range} />
                </TabsContent>
              </Tabs>
            </div>
          )
        ) : null}
      </div>
    </>
  )
}
