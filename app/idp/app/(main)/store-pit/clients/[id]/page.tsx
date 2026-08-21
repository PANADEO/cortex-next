"use client"

import { BREAKDOWNS, CLIENT_SUMMARY } from "@/features/store-pit/dataset"
import {
  ACCENT_BADGE,
  ACCENT_DOT,
  CLIENT_META,
  clientKeyFromSlug,
  count,
  eur,
  kg,
  pct,
  signedEur,
} from "@/features/store-pit/helpers"
import type { ClientParcel } from "@/features/store-pit/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataCard,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Package, Receipt, Scale, SearchX, Users, Wallet } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"

const PAGE_SIZE = 12

const columns: ColumnDef<ClientParcel, unknown>[] = [
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
    accessorKey: "date",
    header: "Date",
    size: 100,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums text-muted-foreground">{row.original.date}</span>
    ),
  },
  {
    accessorKey: "service",
    header: "Service",
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="block truncate text-xs">{row.original.service}</span>
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          {row.original.domExport || "—"}
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
]

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const slug = params?.id ?? ""
  const key = clientKeyFromSlug(slug)

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")

  const meta = key ? CLIENT_META[key] : null
  const summary = key ? CLIENT_SUMMARY.find((c) => c.client === key) : null
  const bd = key ? BREAKDOWNS[key] : null

  const filteredParcels = useMemo(() => {
    const allParcels = bd?.parcels ?? []
    const q = search.trim().toLowerCase()
    if (!q) return allParcels
    return allParcels.filter(
      (p) =>
        p.parcel.toLowerCase().includes(q) ||
        (p.reference ?? "").toLowerCase().includes(q) ||
        (p.recipient ?? "").toLowerCase().includes(q),
    )
  }, [search, bd])

  const total = filteredParcels.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const parcelsPage = filteredParcels.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (!key || !meta || !summary || !bd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-6">
        <EmptyState
          icon={Users}
          title="Client not found"
          description="The requested client does not exist."
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/store-pit/clients">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Clients
          </Link>
        </Button>
      </div>
    )
  }

  const margin = summary.spTotal - summary.glsTotal
  const marginPct = summary.glsTotal > 0 ? margin / summary.glsTotal : 0

  const countryTotals = "countryTotals" in bd ? bd.countryTotals : null
  const bdTotal = "total" in bd ? bd.total : null

  return (
    <>
      <PageHeader
        title={meta.name}
        description={meta.pricingBasis}
        actions={
          <>
            <Badge variant="outline" className={cn("font-medium", ACCENT_BADGE[meta.accent])}>
              {meta.market}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/store-pit/clients">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Card className="overflow-hidden">
          <div className={cn("h-1.5", ACCENT_DOT[meta.accent])} />
          <CardContent className="flex flex-col gap-1 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount to settle
            </div>
            <div className="text-3xl font-semibold tabular-nums">{eur(summary.spTotal)}</div>
            <div className="text-xs text-muted-foreground">
              GLS cost {eur(summary.glsTotal)} · margin {signedEur(margin)} ({pct(marginPct)})
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCard label="Parcels" value={count(summary.qty)} icon={Package} />
          <DataCard label="Weight" value={kg(summary.weight)} icon={Scale} />
          <DataCard label="GLS cost" value={eur(summary.glsTotal)} icon={Receipt} />
          <DataCard label="Store-Pit price" value={eur(summary.spTotal)} icon={Wallet} />
        </section>

        <Tabs defaultValue="breakdown" className="flex flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="breakdown">Service breakdown</TabsTrigger>
            <TabsTrigger value="parcels">Parcels</TabsTrigger>
          </TabsList>

          <TabsContent value="breakdown" className="mt-2">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Dom/Export</th>
                        <th className="px-3 py-2.5 font-medium">Country</th>
                        <th className="px-3 py-2.5 font-medium">Service</th>
                        <th className="px-3 py-2.5 text-right font-medium">Shipments</th>
                        <th className="px-3 py-2.5 text-right font-medium">Weight</th>
                        <th className="px-3 py-2.5 text-right font-medium">Freight</th>
                        <th className="px-3 py-2.5 text-right font-medium">Energy</th>
                        <th className="px-3 py-2.5 text-right font-medium">Service flat</th>
                        <th className="px-3 py-2.5 text-right font-medium">Pre-finance</th>
                        <th className="px-4 py-2.5 text-right font-medium">Grand total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bd.rows.map((r, i) => (
                        <tr
                          key={`${r.country}-${r.service}-${i}`}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {r.domExport || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">{r.country}</td>
                          <td className="px-3 py-2.5 text-xs">{r.service}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {count(r.shipments)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {r.weight ? kg(r.weight) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(r.freight)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(r.energy)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(r.serviceP)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {r.vorfinance ? eur(r.vorfinance) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-medium tabular-nums">
                            {eur(r.grandTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {countryTotals ? (
                      <tfoot>
                        {countryTotals.map((ct) => (
                          <tr
                            key={ct.country}
                            className="border-t border-border/60 bg-muted/30 font-medium"
                          >
                            <td className="px-4 py-2.5 text-xs" colSpan={2}>
                              {ct.label}
                            </td>
                            <td className="px-3 py-2.5 text-xs" />
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                              {count(ct.shipments)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                              {ct.weight ? kg(ct.weight) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                              {eur(ct.freight)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                              {eur(ct.energy)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                              {eur(ct.serviceP)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                              {ct.vorfinance ? eur(ct.vorfinance) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                              {eur(ct.grandTotal)}
                            </td>
                          </tr>
                        ))}
                      </tfoot>
                    ) : bdTotal ? (
                      <tfoot>
                        <tr className="border-t border-border bg-muted/40 font-semibold">
                          <td className="px-4 py-2.5 text-xs" colSpan={3}>
                            Total
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {count(bdTotal.shipments)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {bdTotal.weight ? kg(bdTotal.weight) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(bdTotal.freight)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(bdTotal.energy)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(bdTotal.serviceP)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {bdTotal.vorfinance ? eur(bdTotal.vorfinance) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                            {eur(bdTotal.grandTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parcels" className="mt-2 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search parcel, reference, recipient..."
                value={search}
                onChange={(e) => {
                  setPage(0)
                  setSearch(e.target.value)
                }}
                className="h-9 w-72"
              />
              <div className="ml-auto text-xs text-muted-foreground">
                {count(total)} of {count(bd?.parcels.length ?? 0)} parcels
              </div>
            </div>
            <DataTable
              columns={columns}
              data={parcelsPage}
              getRowId={(r) => r.parcel + r.reference + r.service}
              emptyState={
                <EmptyState
                  icon={SearchX}
                  title="No parcels match"
                  description="Clear the search to see all parcels for this client."
                />
              }
            />
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
