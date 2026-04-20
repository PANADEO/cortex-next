"use client"

import { useActionLogs } from "@cortex/api"
import {
  PACKAGE_ACTION_TYPE,
  type ActionLogReadModel,
  type PackageActionType,
} from "@cortex/types"
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { cn, formatAbsolute, humanizeEnum } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { History, RotateCw } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

const columns: ColumnDef<ActionLogReadModel, unknown>[] = [
  {
    accessorKey: "timestamp",
    header: "When",
    size: 200,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {formatAbsolute(row.original.timestamp)}
      </span>
    ),
  },
  {
    accessorKey: "action_type",
    header: "Event",
    size: 200,
    cell: ({ row }) => (
      <span className="text-xs">{humanizeEnum(row.original.action_type)}</span>
    ),
  },
  {
    accessorKey: "package_file_name",
    header: "Package",
    cell: ({ row }) => (
      <Link
        href={`/packages/${row.original.package_id}`}
        className="font-mono text-xs hover:underline"
      >
        {row.original.package_file_name}
      </Link>
    ),
  },
  {
    accessorKey: "performed_by",
    header: "Actor",
    size: 200,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.performed_by}
      </span>
    ),
  },
]

const PAGE_SIZE = 20

export default function AuditLogPage() {
  const [page, setPage] = useState(0)
  const [actionType, setActionType] = useState<PackageActionType | "all">("all")
  const [performedBy, setPerformedBy] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      action_type: actionType === "all" ? null : actionType,
      performed_by: performedBy || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    }),
    [page, actionType, performedBy, dateFrom, dateTo],
  )

  const { data, isLoading, isFetching, refetch } = useActionLogs(query)
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Cross-package event history."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw className={cn("mr-1 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={actionType}
            onValueChange={(v) => {
              setPage(0)
              setActionType(v as PackageActionType | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {PACKAGE_ACTION_TYPE.map((t) => (
                <SelectItem key={t} value={t}>
                  {humanizeEnum(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Performed by…"
            value={performedBy}
            onChange={(e) => {
              setPage(0)
              setPerformedBy(e.target.value)
            }}
            className="h-9 w-56"
          />
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="audit-date-from"
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                From
              </Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPage(0)
                  setDateFrom(e.target.value)
                }}
                className="h-9 w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="audit-date-to"
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                To
              </Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPage(0)
                  setDateTo(e.target.value)
                }}
                className="h-9 w-[160px]"
              />
            </div>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? "Refreshing…" : `${total} events`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyState={
            <EmptyState icon={History} title="No events match" description="Try clearing filters." />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
