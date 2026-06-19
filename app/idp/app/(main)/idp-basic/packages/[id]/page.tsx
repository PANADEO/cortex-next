"use client"

import { DocumentPreviewPanel } from "@/components/idp-basic/document-preview-panel"
import { IdpBasicStatusBadge } from "@/components/idp-basic/status"
import { useIdpBasicPackage } from "@/lib/idp-basic/hooks"
import {
  Button,
  Card,
  CardContent,
  DataCard,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

export default function IdpBasicPackageDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const detail = useIdpBasicPackage(id)
  const pkg = detail.data

  if (detail.isPending && !pkg) return <LoadingState label="Loading package…" />
  if (detail.error || !pkg) {
    return (
      <ErrorState
        title="Package not found"
        message="The selected IDP Basic package could not be loaded."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={pkg.subject}
        description="Extracted reference and classified documents."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/idp-basic/packages">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Packages
            </Link>
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-6">
        <section className="grid gap-4 lg:grid-cols-4">
          <DataCard label="Reference" value={pkg.reference_number ?? "—"} />
          <DataCard label="Documents" value={pkg.document_count} icon={FileText} />
          <DataCard label="Sender" value={pkg.sender || "—"} />
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <div className="flex items-center gap-2">
                <IdpBasicStatusBadge status={pkg.status} />
                {detail.isFetching && pkg.status !== "ready" && pkg.status !== "failed" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Received {pkg.received_at ? formatAbsolute(pkg.received_at) : "—"}
              </p>
            </CardContent>
          </Card>
        </section>

        {pkg.error_message ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {pkg.error_message}
          </div>
        ) : null}

        <DocumentPreviewPanel packageId={pkg.id} documents={pkg.documents} />
      </div>
    </div>
  )
}
