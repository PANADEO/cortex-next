"use client"

import { IntrastatResourceUploadButton } from "@/components/intrastat/resource-upload-button"
import { IntrastatKindBadge, IntrastatStatusBadge } from "@/components/intrastat/status"
import { IntrastatUploadBatchButton } from "@/components/intrastat/upload-batch-button"
import {
  useIntrastatBatches,
  useIntrastatCnResource,
  useIntrastatSettings,
  useIntrastatStats,
} from "@/lib/intrastat/hooks"
import { Button, Card, CardContent, CardHeader, CardTitle, DataCard, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { AlertTriangle, Database, FileSpreadsheet, FolderInput, Package, Rows3 } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export default function IntrastatDashboardPage() {
  const { t } = useTranslation("intrastat")
  const stats = useIntrastatStats()
  const settings = useIntrastatSettings()
  const resource = useIntrastatCnResource()
  const batches = useIntrastatBatches({ limit: 8, offset: 0 })
  const currentResource = resource.data

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Intrastat"
        description={t("dashboard.description")}
        actions={
          <div className="flex items-center gap-2">
            <IntrastatResourceUploadButton />
            <IntrastatUploadBatchButton />
          </div>
        }
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-4">
        <DataCard
          label={t("dashboard.batchesLabel")}
          value={String(stats.data?.batches_total ?? 0)}
          description={t("dashboard.batchesProcessing", { count: stats.data?.processing ?? 0 })}
          icon={Package}
        />
        <DataCard
          label={t("dashboard.linesLabel")}
          value={String(stats.data?.lines_total ?? 0)}
          description={t("dashboard.linesNeedReview", { count: stats.data?.needs_review ?? 0 })}
          icon={Rows3}
          tone={(stats.data?.needs_review ?? 0) > 0 ? "warning" : "default"}
        />
        <DataCard
          label={t("dashboard.cnResourceLabel")}
          value={String(currentResource?.row_count ?? 0)}
          description={currentResource?.file_name ?? t("dashboard.noResource")}
          icon={Database}
          tone={currentResource?.row_count ? "success" : "warning"}
        />
        <DataCard
          label={t("dashboard.filesystemLabel")}
          value={
            settings.data?.filesystem_configured
              ? t("dashboard.filesystemReady")
              : t("dashboard.filesystemNotConfigured")
          }
          description={settings.data?.intrastat_watch_dir ?? t("dashboard.watchDirMissing")}
          icon={FolderInput}
          tone={settings.data?.filesystem_configured ? "success" : "warning"}
        />

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("dashboard.recentBatches")}</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/intrastat/batches">{t("dashboard.openBatches")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      {t("dashboard.columnBatch")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      {t("dashboard.columnType")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      {t("dashboard.columnLines")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      {t("dashboard.columnStatus")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      {t("dashboard.columnUpdated")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(batches.data?.items ?? []).map((batch) => (
                    <tr key={batch.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/intrastat/review?batch=${batch.id}`}
                          className="font-medium hover:underline"
                        >
                          {batch.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <IntrastatKindBadge kind={batch.transaction_kind} />
                      </td>
                      <td className="px-4 py-3">{batch.line_count}</td>
                      <td className="px-4 py-3">
                        <IntrastatStatusBadge status={batch.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatAbsolute(batch.updated_at)}
                      </td>
                    </tr>
                  ))}
                  {!batches.isLoading && (batches.data?.items.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {t("dashboard.emptyBatches")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold">{t("dashboard.reviewRulesTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("dashboard.reviewRulesBody")}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/intrastat/review">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t("dashboard.reviewLines")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
