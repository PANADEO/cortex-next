"use client"

import { IdpBasicDeletePackageButton } from "@/components/idp-basic/delete-actions"
import { DocumentPreviewPanel } from "@/components/idp-basic/document-preview-panel"
import { IdpBasicReprocessPackageButton } from "@/components/idp-basic/reprocess-actions"
import {
  formatIdpBasicDisplayText,
  getIdpBasicDocumentTypeLabel,
  IdpBasicCompletenessBadge,
  IdpBasicStatusBadge,
} from "@/components/idp-basic/status"
import { useIdpBasicResult } from "@/lib/idp-basic/hooks"
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataCard,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { AlertTriangle, ArrowLeft, FileText, Mail } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

export default function IdpBasicResultDetailPage() {
  const { t } = useTranslation("idp-basic")
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const detail = useIdpBasicResult(id)
  const result = detail.data
  const isActivePackage = result?.status === "queued" || result?.status === "processing"
  const sourceFilesAvailable = result?.source_files_available === true

  if (detail.isPending && !result) return <LoadingState label={t("results.loadingDetail")} />
  if (detail.error || !result) {
    return (
      <ErrorState title={t("results.notFoundTitle")} message={t("results.notFoundDescription")} />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      <PageHeader
        title={result.reference_number ?? t("results.noReference")}
        description={result.subject}
        actions={
          <div className="flex items-center gap-2">
            <IdpBasicReprocessPackageButton
              packageId={result.id}
              packageName={result.subject}
              disabled={isActivePackage || !sourceFilesAvailable}
              disabledReason={sourceFilesAvailable ? undefined : t("results.sourceFilesMissing")}
            />
            <IdpBasicDeletePackageButton
              packageId={result.id}
              packageName={result.subject}
              redirectTo="/idp-basic/results"
              disabled={isActivePackage}
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/idp-basic/results">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("actions.backToResults")}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-visible px-8 py-5 lg:overflow-hidden">
        <section className="grid shrink-0 gap-3 lg:grid-cols-4">
          <DataCard label={t("fields.reference")} value={result.reference_number ?? "—"} />
          <DataCard label={t("fields.documents")} value={result.document_count} icon={FileText} />
          <Card>
            <CardContent className="space-y-1.5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("fields.completeness")}
              </p>
              <IdpBasicCompletenessBadge status={result.completeness_status} />
              {result.missing_required.length > 0 || result.missing_optional.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {[...result.missing_required, ...result.missing_optional]
                    .map((missing) => formatIdpBasicDisplayText(t, missing))
                    .join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1.5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("fields.processing")}
              </p>
              <IdpBasicStatusBadge status={result.status} />
              <p className="text-xs text-muted-foreground">
                {result.received_at ? formatAbsolute(result.received_at) : t("results.noMailDate")}
              </p>
            </CardContent>
          </Card>
        </section>

        {result.alerts.length > 0 ? (
          <section className="shrink-0 rounded-md border border-warning/40 bg-warning/5 px-4 py-2.5">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="h-4 w-4" />
              {t("results.alerts")}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.alerts.map((alert) => (
                <Badge key={alert} variant="outline" className="border-warning/40 text-warning">
                  {formatIdpBasicDisplayText(t, alert)}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <DocumentPreviewPanel
          packageId={result.id}
          documents={result.documents}
          deleteDisabled={isActivePackage}
          sidebarSlot={
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {t("results.sourceEmail")}
                </div>
                <dl className="grid content-start gap-1.5 text-xs">
                  <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[86px_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">{t("fields.sender")}</dt>
                    <dd className="break-all">{result.sender || "—"}</dd>
                  </div>
                  <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[86px_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">{t("fields.subject")}</dt>
                    <dd className="break-words">{result.subject}</dd>
                  </div>
                  <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[86px_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">{t("fields.mailDate")}</dt>
                    <dd>{result.received_at ? formatAbsolute(result.received_at) : "—"}</dd>
                  </div>
                  <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[86px_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">{t("fields.messageId")}</dt>
                    <dd className="break-all">{result.message_id ?? "—"}</dd>
                  </div>
                </dl>
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-sm font-medium">{t("fields.detectedTypes")}</p>
                  <div className="flex flex-wrap gap-2">
                    {result.document_types.length > 0 ? (
                      result.document_types.map((type) => (
                        <Badge key={type} variant="secondary">
                          {getIdpBasicDocumentTypeLabel(t, type)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("results.noDetectedTypes")}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          }
        />
      </div>
    </div>
  )
}
