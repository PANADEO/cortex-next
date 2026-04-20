"use client"

import { useDashboardStats, usePackages } from "@cortex/api"
import { DataCard, DataTable, EmptyState, PageHeader, StatusBadge } from "@cortex/ui"
import { formatRelative } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  Inbox,
  Loader2,
  PlayCircle,
} from "lucide-react"
import Link from "next/link"
import type { PackageReadModel } from "@cortex/types"

const columns: ColumnDef<PackageReadModel, unknown>[] = [
  {
    accessorKey: "file_name",
    header: "File",
    cell: ({ row }) => (
      <Link
        href={`/packages/${row.original.id}`}
        className="font-mono text-xs hover:underline"
      >
        {row.original.file_name}
      </Link>
    ),
  },
  {
    accessorKey: "created_date",
    header: "Created",
    size: 180,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(row.original.created_date)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 180,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "assignee",
    header: "Assignee",
    size: 180,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.assignee ?? "—"}
      </span>
    ),
  },
]

export default function DashboardPage() {
  const stats = useDashboardStats()
  const recent = usePackages({ limit: 5, sort_by: "created_date", sort_order: "desc" })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of the IDP processing pipeline."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <DataCard
            label="In queue"
            value={stats.data?.in_queue ?? 0}
            icon={Inbox}
            isLoading={stats.isLoading}
            tone="info"
          />
          <DataCard
            label="Processing"
            value={stats.data?.processing ?? 0}
            icon={Loader2}
            isLoading={stats.isLoading}
            tone="info"
          />
          <DataCard
            label="Ready"
            value={stats.data?.ready_for_verification ?? 0}
            icon={PlayCircle}
            isLoading={stats.isLoading}
            tone="success"
          />
          <DataCard
            label="In verification"
            value={stats.data?.in_verification ?? 0}
            icon={Loader2}
            isLoading={stats.isLoading}
            tone="warning"
          />
          <DataCard
            label="Verified"
            value={stats.data?.verified ?? 0}
            icon={CheckCircle2}
            isLoading={stats.isLoading}
            tone="success"
          />
          <DataCard
            label="Failed"
            value={stats.data?.failed ?? 0}
            icon={AlertTriangle}
            isLoading={stats.isLoading}
            tone="destructive"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent packages</h2>
            <Link
              href="/packages"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <DataTable
            columns={columns}
            data={recent.data?.items ?? []}
            isLoading={recent.isLoading}
            emptyState={
              <EmptyState
                icon={FileQuestion}
                title="No packages yet"
                description="Upload your first ZIP to see it here."
              />
            }
            getRowId={(row) => row.id}
          />
        </section>
      </div>
    </>
  )
}
