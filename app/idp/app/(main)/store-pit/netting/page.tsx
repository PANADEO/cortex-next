"use client"

import { NETTING_ROWS, NETTING_SUMMARY } from "@/features/store-pit/dataset"
import { ACCENT_BADGE, CLIENT_META, count, eur } from "@/features/store-pit/helpers"
import type { ClientKey, NettingRow } from "@/features/store-pit/types"
import {
  Badge,
  Button,
  DataCard,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { SearchX, Table2 } from "lucide-react"
import { useMemo, useState } from "react"

const PAGE_SIZE = 15

const COUNTRIES = ["DE", "FR", "NL", "DK"] as const

function clientAccent(client: string): string {
  const meta = CLIENT_META[client as ClientKey]
  return meta ? ACCENT_BADGE[meta.accent] : "border-border bg-muted text-muted-foreground"
}

const columns: ColumnDef<NettingRow, unknown>[] = [
  {
    accessorKey: "parcel",
    header: "Parcel / reference",
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="block truncate font-mono text-xs font-medium">{row.original.parcel}</span>
        <span className="block truncate font-mono text-[10px] text-muted-foreground">
          {row.original.reference}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "client",
    header: "Client",
    size: 130,
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("font-medium", clientAccent(row.original.client))}>
        {row.original.client}
      </Badge>
    ),
  },
  {
    accessorKey: "country",
    header: "Country",
    size: 90,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums text-muted-foreground">{row.original.country}</span>
    ),
  },
  {
    accessorKey: "matchedService",
    header: "Matched service",
    cell: ({ row }) => (
      <span className="block truncate text-xs">{row.original.matchedService}</span>
    ),
  },
  {
    accessorKey: "discount",
    header: "Discount",
    size: 100,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums text-destructive">{eur(row.original.discount)}</span>
    ),
  },
  {
    accessorKey: "before",
    header: "Freight before",
    size: 120,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums text-muted-foreground">{eur(row.original.before)}</span>
    ),
  },
  {
    accessorKey: "after",
    header: "Freight after",
    size: 120,
    cell: ({ row }) => (
      <span className="text-xs font-medium tabular-nums">{eur(row.original.after)}</span>
    ),
  },
]

export default function NettingPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [country, setCountry] = useState<string>("all")
  const [matched, setMatched] = useState<string>("all")

  const resetPage = () => setPage(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return NETTING_ROWS.filter((r) => {
      if (country !== "all" && r.country !== country) return false
      if (matched !== "all" && r.matched !== matched) return false
      if (!q) return true
      return r.parcel.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q)
    })
  }, [search, country, matched])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const filtersDirty = search !== "" || country !== "all" || matched !== "all"

  return (
    <>
      <PageHeader
        title="Netting"
        description="ShopDelivery -0.50 discounts matched to parcels and netted against freight."
        actions={
          <span className="text-xs text-muted-foreground">
            {count(NETTING_SUMMARY.matched)} of {count(NETTING_SUMMARY.rows)} matched
          </span>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCard label="Discount lines" value={count(NETTING_SUMMARY.rows)} />
          <DataCard
            label="Matched"
            value={count(NETTING_SUMMARY.matched)}
            tone="success"
          />
          <DataCard
            label="Unmatched"
            value={count(NETTING_SUMMARY.unmatched)}
            tone={NETTING_SUMMARY.unmatched > 0 ? "warning" : "success"}
          />
          <DataCard label="Discount total" value={eur(NETTING_SUMMARY.discountTotal)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search parcel, reference..."
            value={search}
            onChange={(e) => {
              resetPage()
              setSearch(e.target.value)
            }}
            className="h-9 w-72"
          />
          <Select
            value={country}
            onValueChange={(v) => {
              resetPage()
              setCountry(v)
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={matched}
            onValueChange={(v) => {
              resetPage()
              setMatched(v)
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Matched" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Yes">Matched</SelectItem>
            </SelectContent>
          </Select>
          {filtersDirty ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                resetPage()
                setSearch("")
                setCountry("all")
                setMatched("all")
              }}
            >
              Reset
            </Button>
          ) : null}
          <div className="ml-auto text-xs text-muted-foreground">
            {count(total)} of {count(NETTING_SUMMARY.rows)}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.parcel + r.reference}
          emptyState={
            <EmptyState
              icon={SearchX}
              title="No lines match"
              description="Clear the filters to see all netting lines."
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />

        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          Each matched discount reduces that parcel&apos;s GLS freight before the per-client mark-up
          is applied, so the saving is passed through correctly.
        </p>
      </div>
    </>
  )
}
