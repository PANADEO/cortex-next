"use client"

import { EXTRACTION_ROWS, INVOICE } from "@/features/store-pit/dataset"
import { ACCENT_BADGE, CLIENT_META, count, eur, kg } from "@/features/store-pit/helpers"
import type { ClientKey, ExtractionRow } from "@/features/store-pit/types"
import {
  Badge,
  Button,
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

const PAGE_SIZE = 12

const COUNTRIES = ["DE", "FR", "NL", "DK"] as const
const SERVICES = Array.from(new Set(EXTRACTION_ROWS.map((r) => r.service))).sort()

function clientAccent(client: string): string {
  const meta = CLIENT_META[client as ClientKey]
  return meta ? ACCENT_BADGE[meta.accent] : "border-border bg-muted text-muted-foreground"
}

const columns: ColumnDef<ExtractionRow, unknown>[] = [
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
    accessorKey: "service",
    header: "Service",
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="block truncate text-xs">{row.original.service}</span>
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          {row.original.domExport} · {row.original.articleNo}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "city",
    header: "Destination",
    size: 180,
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="block truncate text-xs">{row.original.city || "—"}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {row.original.country} · {row.original.recipient || "—"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "weight",
    header: "Weight",
    size: 90,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums text-muted-foreground">
        {row.original.weight ? kg(row.original.weight) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "net",
    header: "GLS net",
    size: 110,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums">{eur(row.original.net)}</span>
    ),
  },
  {
    accessorKey: "shopDiscount",
    header: "Discount",
    size: 100,
    cell: ({ row }) =>
      row.original.shopDiscount ? (
        <span className="text-xs tabular-nums text-destructive">{eur(row.original.shopDiscount)}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "netAfter",
    header: "Net after",
    size: 110,
    cell: ({ row }) => (
      <span className="text-xs font-medium tabular-nums">{eur(row.original.netAfter)}</span>
    ),
  },
]

export default function ExtractionPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [client, setClient] = useState<string>("all")
  const [country, setCountry] = useState<string>("all")
  const [service, setService] = useState<string>("all")

  const resetPage = () => setPage(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return EXTRACTION_ROWS.filter((r) => {
      if (client !== "all" && r.client !== client) return false
      if (country !== "all" && r.country !== country) return false
      if (service !== "all" && r.service !== service) return false
      if (!q) return true
      return (
        r.parcel.toLowerCase().includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q) ||
        (r.recipient ?? "").toLowerCase().includes(q) ||
        (r.city ?? "").toLowerCase().includes(q)
      )
    })
  }, [search, client, country, service])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const filtersDirty = search !== "" || client !== "all" || country !== "all" || service !== "all"

  return (
    <>
      <PageHeader
        title="Extraction"
        description="Structured shipment lines parsed from the GLS CSV detail and PDF summary."
        actions={
          <span className="text-xs text-muted-foreground">
            {count(INVOICE.shipmentRows)} parcel lines · {count(INVOICE.csvRows)} CSV rows
          </span>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search parcel, reference, recipient…"
            value={search}
            onChange={(e) => {
              resetPage()
              setSearch(e.target.value)
            }}
            className="h-9 w-72"
          />
          <Select
            value={client}
            onValueChange={(v) => {
              resetPage()
              setClient(v)
            }}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {Object.values(CLIENT_META).map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            value={service}
            onValueChange={(v) => {
              resetPage()
              setService(v)
            }}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {SERVICES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
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
                setClient("all")
                setCountry("all")
                setService("all")
              }}
            >
              Reset
            </Button>
          ) : null}
          <div className="ml-auto text-xs text-muted-foreground">{count(total)} of sample shown</div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => String(r.row)}
          emptyState={
            <EmptyState
              icon={SearchX}
              title="No lines match"
              description="Clear the filters to see the full extracted sample."
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />

        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          Showing a representative sample of the {count(INVOICE.shipmentRows)} parcel lines extracted
          for invoice {INVOICE.glsInvoiceNo}. Invoice-level charges are handled under Reconciliation.
        </p>
      </div>
    </>
  )
}
