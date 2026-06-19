"use client"

import { IdpBasicStatusBadge } from "@/components/idp-basic/status"
import { IdpBasicUploadPackageButton } from "@/components/idp-basic/upload-package-button"
import {
  useIdpBasicPackages,
  useIdpBasicPollMail,
  useIdpBasicSettings,
  useIdpBasicStats,
} from "@/lib/idp-basic/hooks"
import type { IdpBasicPackageSummary } from "@/lib/idp-basic/types"
import { Button, DataCard, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { Inbox, Loader2, MailCheck, PackageSearch } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { toast } from "sonner"

const columns: ColumnDef<IdpBasicPackageSummary>[] = [
  {
    accessorKey: "subject",
    header: "Package",
    cell: ({ row }) => (
      <Link href={`/idp-basic/packages/${row.original.id}`} className="font-medium hover:underline">
        {row.original.subject}
      </Link>
    ),
  },
  {
    accessorKey: "reference_number",
    header: "Reference",
    cell: ({ row }) => row.original.reference_number ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <IdpBasicStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "document_count",
    header: "Docs",
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatAbsolute(row.original.created_at),
  },
]

export default function IdpBasicDashboardPage() {
  const stats = useIdpBasicStats()
  const settings = useIdpBasicSettings()
  const packages = useIdpBasicPackages({ limit: 5, offset: 0 })
  const pollMail = useIdpBasicPollMail()

  const items = useMemo(() => packages.data?.items ?? [], [packages.data?.items])

  const handlePoll = async () => {
    try {
      const result = await pollMail.mutateAsync()
      toast.success(`Imported ${result.imported} new package(s)`)
    } catch {
      toast.error("Mailbox poll failed")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="IDP Basic Inbox"
        description="Mailbox-driven package intake and simple document classification."
        actions={
          <div className="flex items-center gap-2">
            <IdpBasicUploadPackageButton redirectToPackage />
            <Button
              size="sm"
              onClick={handlePoll}
              disabled={pollMail.isPending || !settings.data?.mailbox_configured}
            >
              {pollMail.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailCheck className="mr-2 h-4 w-4" />
              )}
              Poll now
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="grid gap-4 md:grid-cols-4">
          <DataCard
            label="Packages"
            value={stats.data?.packages_total ?? 0}
            isLoading={stats.isLoading}
          />
          <DataCard
            label="Queued"
            value={stats.data?.queued ?? 0}
            isLoading={stats.isLoading}
            tone="info"
          />
          <DataCard
            label="Processing"
            value={stats.data?.processing ?? 0}
            isLoading={stats.isLoading}
            tone="warning"
          />
          <DataCard
            label="Ready"
            value={stats.data?.ready ?? 0}
            isLoading={stats.isLoading}
            tone="success"
          />
        </section>

        <DataCard
          label="Mailbox"
          value={settings.data?.mailbox_configured ? "Connected" : "Not configured"}
          description={
            settings.data?.mailbox_configured
              ? `${settings.data.imap_host ?? "IMAP"} / ${settings.data.imap_mailbox}`
              : "Set IMAP env vars in idp-basic backend"
          }
          icon={Inbox}
          tone={settings.data?.mailbox_configured ? "success" : "warning"}
        />

        <DataTable
          columns={columns}
          data={items}
          isLoading={packages.isPending && items.length === 0}
          bordered
          emptyState={
            <EmptyState
              icon={PackageSearch}
              title="No packages yet"
              description="New unseen mailbox messages will appear here after the poller imports them."
            />
          }
        />
      </div>
    </div>
  )
}
