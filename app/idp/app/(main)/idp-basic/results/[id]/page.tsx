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

export default function IdpBasicResultDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const detail = useIdpBasicResult(id)
  const result = detail.data
  const isActivePackage = result?.status === "queued" || result?.status === "processing"
  const sourceFilesAvailable = result?.source_files_available === true

  if (detail.isPending && !result) return <LoadingState label="Loading result..." />
  if (detail.error || !result) {
    return (
      <ErrorState
        title="Result not found"
        message="The selected IDP Basic result could not be loaded."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={result.reference_number ?? "No reference"}
        description={result.subject}
        actions={
          <div className="flex items-center gap-2">
            <IdpBasicReprocessPackageButton
              packageId={result.id}
              packageName={result.subject}
              disabled={isActivePackage || !sourceFilesAvailable}
              disabledReason={
                sourceFilesAvailable ? undefined : "Source files are missing for this package."
              }
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
                Results
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-6">
        <section className="grid gap-4 lg:grid-cols-4">
          <DataCard label="Reference" value={result.reference_number ?? "—"} />
          <DataCard label="Documents" value={result.document_count} icon={FileText} />
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Completeness
              </p>
              <IdpBasicCompletenessBadge status={result.completeness_status} />
              {result.missing_required.length > 0 || result.missing_optional.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {[...result.missing_required, ...result.missing_optional]
                    .map(formatIdpBasicDisplayText)
                    .join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Processing
              </p>
              <IdpBasicStatusBadge status={result.status} />
              <p className="text-xs text-muted-foreground">
                {result.received_at ? formatAbsolute(result.received_at) : "No mail date"}
              </p>
            </CardContent>
          </Card>
        </section>

        {result.alerts.length > 0 ? (
          <section className="rounded-md border border-warning/40 bg-warning/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="h-4 w-4" />
              Alerts
            </div>
            <div className="flex flex-wrap gap-2">
              {result.alerts.map((alert) => (
                <Badge key={alert} variant="outline" className="border-warning/40 text-warning">
                  {formatIdpBasicDisplayText(alert)}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Source email
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Sender</dt>
                <dd className="break-all">{result.sender || "—"}</dd>
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{result.subject}</dd>
                <dt className="text-muted-foreground">Mail date</dt>
                <dd>{result.received_at ? formatAbsolute(result.received_at) : "—"}</dd>
                <dt className="text-muted-foreground">Message ID</dt>
                <dd className="break-all">{result.message_id ?? "—"}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Detected types</p>
              <div className="flex flex-wrap gap-2">
                {result.document_types.length > 0 ? (
                  result.document_types.map((type) => (
                    <Badge key={type} variant="secondary">
                      {getIdpBasicDocumentTypeLabel(type)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No detected types</span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <DocumentPreviewPanel
          packageId={result.id}
          documents={result.documents}
          deleteDisabled={isActivePackage}
        />
      </div>
    </div>
  )
}
