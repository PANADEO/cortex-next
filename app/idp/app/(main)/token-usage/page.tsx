"use client"

import { DataQualityNote } from "@/features/token-usage/components/data-quality-note"
import { DateRangeFilter } from "@/features/token-usage/components/date-range-filter"
import { DetailTable } from "@/features/token-usage/components/detail-table"
import { DimensionPanel } from "@/features/token-usage/components/dimension-panel"
import { MetricsBar } from "@/features/token-usage/components/metrics-bar"
import { useTokenUsageReport } from "@/features/token-usage/hooks"
import { defaultRange } from "@/features/token-usage/presets"
import { readUsageErrorCode } from "@/features/token-usage/queries"
import type { TokenUsageErrorCode, UsageDateRange } from "@/features/token-usage/types"
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

/**
 * Komunikaty rozróżniają BRAK KONFIGURACJI od AWARII — to nie kosmetyka:
 * pierwsze jest zadaniem dla administratora instancji i da się naprawić,
 * drugie oznacza, że cudzy serwis leży i trzeba czekać.
 */
const ERROR_COPY: Record<TokenUsageErrorCode, { title: string; message: string }> = {
  "cortex-proxy-not-configured": {
    title: "Raport nie jest skonfigurowany",
    message:
      "Ta instancja nie ma ustawionego klucza administracyjnego cortex-proxy " +
      "(CORTEX_PROXY_ADMIN_API_KEY). To zadanie konfiguracyjne po stronie administratora " +
      "instancji — pozostałe kafelki działają normalnie.",
  },
  "cortex-proxy-unauthorized": {
    title: "cortex-proxy odrzucił klucz administracyjny",
    message:
      "Klucz jest ustawiony, ale cortex-proxy go nie uznaje. Najczęstsza przyczyna: " +
      "wpisano CORTEX_PROXY_API_KEY zamiast CORTEX_PROXY_ADMIN_API_KEY — to dwa różne sekrety.",
  },
  "cortex-proxy-unreachable": {
    title: "cortex-proxy nie odpowiada",
    message: "Nie udało się połączyć z cortex-proxy. Spróbuj ponownie za chwilę.",
  },
  "cortex-proxy-error": {
    title: "Nieoczekiwana odpowiedź cortex-proxy",
    message: "cortex-proxy odpowiedział w sposób, którego nie potrafimy odczytać.",
  },
  "invalid-format": { title: "Nieprawidłowy zakres dat", message: "Daty muszą mieć format RRRR-MM-DD." },
  "invalid-date": { title: "Nieprawidłowa data", message: "Podana data nie istnieje w kalendarzu." },
  "reversed-range": {
    title: "Nieprawidłowy zakres dat",
    message: "Data początkowa nie może być późniejsza niż końcowa.",
  },
  "range-too-long": {
    title: "Zakres jest zbyt długi",
    message: "Wybierz krótszy przedział — raport obejmuje maksymalnie jeden kwartał.",
  },
}

export default function TokenUsagePage() {
  // Stan początkowy liczony raz (inicjalizator useState), nie przy każdym
  // renderze — inaczej obiekt zakresu byłby nowy za każdym razem i klucz
  // zapytania zmieniałby się w kółko.
  const [range, setRange] = useState<UsageDateRange>(() => defaultRange())
  const report = useTokenUsageReport(range)

  const errorCode = readUsageErrorCode(report.error)
  const copy = errorCode ? ERROR_COPY[errorCode] : null

  return (
    <>
      <PageHeader
        title="Raportowanie Tokenów"
        description="Zużycie tokenów i liczba żądań przechodzących przez cortex-proxy"
      />

      <div className="space-y-6 p-6">
        <DateRangeFilter value={range} onChange={setRange} isLoading={report.isFetching} />
        <DataQualityNote />

        {report.isPending ? <LoadingState /> : null}

        {report.isError ? (
          <ErrorState
            title={copy?.title ?? "Nie udało się wczytać raportu"}
            message={copy?.message ?? "Spróbuj ponownie za chwilę."}
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
              title="Brak danych w tym okresie"
              description="W wybranym zakresie dat cortex-proxy nie zarejestrował żadnych żądań."
            />
          ) : (
            <div className="space-y-6">
              <MetricsBar totals={report.data.totals} />

              <Tabs defaultValue="users">
                <TabsList>
                  <TabsTrigger value="users">Użytkownicy</TabsTrigger>
                  <TabsTrigger value="models">Modele</TabsTrigger>
                  <TabsTrigger value="apps">Aplikacje</TabsTrigger>
                  <TabsTrigger value="scopes">Zakresy</TabsTrigger>
                  <TabsTrigger value="details">Szczegóły</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="pt-4">
                  <DimensionPanel
                    title="Zużycie według użytkowników"
                    dimensionLabel="Użytkownik"
                    groups={report.data.byUser}
                    range={report.data.range}
                    exportKind="uzytkownicy"
                    showUserCount={false}
                  />
                </TabsContent>

                <TabsContent value="models" className="pt-4">
                  <DimensionPanel
                    title="Zużycie według modeli"
                    dimensionLabel="Model"
                    groups={report.data.byModel}
                    range={report.data.range}
                    exportKind="modele"
                  />
                </TabsContent>

                <TabsContent value="apps" className="pt-4">
                  <DimensionPanel
                    title="Zużycie według aplikacji"
                    dimensionLabel="Aplikacja"
                    groups={report.data.byApp}
                    range={report.data.range}
                    exportKind="aplikacje"
                  />
                </TabsContent>

                <TabsContent value="scopes" className="pt-4">
                  <DimensionPanel
                    title="Zużycie według zakresów"
                    dimensionLabel="Zakres"
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
