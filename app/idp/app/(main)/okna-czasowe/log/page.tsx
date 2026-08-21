"use client"

import { useScanLog } from "@/features/okna-czasowe/hooks/use-log"
import { useRunScan } from "@/features/okna-czasowe/hooks/use-scan"
import { toastApiError } from "@cortex/api"
import { Button, Card, CardContent, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { Info, Loader2, ScanSearch, ScrollText } from "lucide-react"
import { useMemo } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"
import { buildLogColumns } from "./columns"

export default function OknaCzasoweLogPage() {
  const { t } = useTranslation("okna-czasowe")
  const logQuery = useScanLog()
  const runScan = useRunScan()

  const entries = [...(logQuery.data ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const columns = useMemo(() => buildLogColumns(t), [t])

  async function handleScan() {
    try {
      const result = await runScan.mutateAsync()
      toast.success(
        // Dwie liczby w jednym zdaniu, a i18next umie odmienić tylko jedną:
        // `count` odmienia człon o filmach, drugi człon przychodzi gotowy
        // z osobnego klucza mnogiego i wchodzi w {{availabilities}}.
        t("scan.success", {
          count: result.log.filmsScanned,
          availabilities: t("scan.newAvailabilities", {
            count: result.log.newAvailabilities,
          }),
        }),
      )
    } catch (error) {
      toastApiError(error, t("scan.failed"))
    }
  }

  return (
    <>
      <PageHeader
        title={t("log.title")}
        description={t("log.description")}
        actions={
          <Button size="sm" onClick={handleScan} disabled={runScan.isPending}>
            {runScan.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("scan.run")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Card className="border-border/70 bg-muted/30">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("log.cronTitle")}</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("log.cronIntro")}</p>
            <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
              <code>
                {`# crontab -e — ${t("log.cronComment")}
0 6 * * * OKNA_CZASOWE_BASE_URL=https://<${t("log.cronHost")}> node /path/to/cortex-frontend/scripts/okna-czasowe-scan.mjs >> /var/log/okna-czasowe-scan.log 2>&1`}
              </code>
            </pre>
            {/* Trans, bo zdanie ma w środku trzy fragmenty kodu — rozbicie go na
                osobne klucze zostawiłoby tłumaczowi strzępy bez składni. */}
            <p className="text-xs text-muted-foreground">
              <Trans
                t={t}
                i18nKey="log.localDev"
                components={{
                  cmd: <code className="rounded bg-background px-1 py-0.5" />,
                  url: <code className="rounded bg-background px-1 py-0.5" />,
                  endpoint: <code className="rounded bg-background px-1 py-0.5" />,
                }}
              />
            </p>
          </CardContent>
        </Card>

        {!logQuery.isLoading && entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("log.emptyTitle")}
            description={t("log.emptyDescription")}
          />
        ) : (
          <DataTable
            columns={columns}
            data={entries}
            isLoading={logQuery.isLoading}
            bordered
            getRowId={(entry) => entry.id}
          />
        )}
      </div>
    </>
  )
}
