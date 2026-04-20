import type { Story } from "@ladle/react"
import type { ColumnDef } from "@tanstack/react-table"
import { Inbox } from "lucide-react"
import { DataTable } from "./data-table"
import { EmptyState } from "./empty-state"
import { PackageStatusBadges } from "./status-badge"

interface Row {
  id: string
  reference: string
  supplier: string
  imported_at: string
  processing: "imported" | "analysing" | "ready" | "analysis_failed"
  verification: "not_started" | "in_progress" | "completed"
}

const ROWS: Row[] = [
  {
    id: "1",
    reference: "PKG-2026-0412",
    supplier: "Acme GmbH",
    imported_at: "2026-04-18",
    processing: "ready",
    verification: "completed",
  },
  {
    id: "2",
    reference: "PKG-2026-0413",
    supplier: "Fabrikam SA",
    imported_at: "2026-04-19",
    processing: "analysing",
    verification: "not_started",
  },
  {
    id: "3",
    reference: "PKG-2026-0414",
    supplier: "Contoso Ltd",
    imported_at: "2026-04-19",
    processing: "ready",
    verification: "in_progress",
  },
  {
    id: "4",
    reference: "PKG-2026-0415",
    supplier: "Northwind Traders",
    imported_at: "2026-04-20",
    processing: "analysis_failed",
    verification: "not_started",
  },
]

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: "reference", header: "Reference" },
  { accessorKey: "supplier", header: "Supplier" },
  { accessorKey: "imported_at", header: "Imported" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <PackageStatusBadges
        processingState={row.original.processing}
        verificationState={row.original.verification}
        showIcon
      />
    ),
  },
]

export default {
  title: "Domain / DataTable",
}

export const WithData: Story = () => (
  <div className="p-6">
    <DataTable columns={COLUMNS} data={ROWS} bordered />
  </div>
)

export const Clickable: Story = () => (
  <div className="p-6">
    <DataTable
      columns={COLUMNS}
      data={ROWS}
      bordered
      onRowClick={(row) => console.log("row clicked", row.id)}
    />
  </div>
)

export const Loading: Story = () => (
  <div className="p-6">
    <DataTable columns={COLUMNS} data={[]} isLoading bordered />
  </div>
)

export const EmptyDefault: Story = () => (
  <div className="p-6">
    <DataTable columns={COLUMNS} data={[]} bordered />
  </div>
)

export const EmptyCustom: Story = () => (
  <div className="p-6">
    <DataTable
      columns={COLUMNS}
      data={[]}
      bordered
      emptyState={
        <EmptyState
          icon={Inbox}
          title="No packages"
          description="Nothing matches your current filters."
        />
      }
    />
  </div>
)
