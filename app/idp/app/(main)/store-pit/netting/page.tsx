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
import type { TFunction } from "i18next"
import { SearchX, Table2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const PAGE_SIZE = 15

const COUNTRIES = ["DE", "FR", "NL", "DK"] as const

function clientAccent(client: string): string {
  const meta = CLIENT_META[client as ClientKey]
  return meta ? ACCENT_BADGE[meta.accent] : "border-border bg-muted text-muted-foreground"
}

function buildColumns(t: TFunction<"store-pit">): ColumnDef<NettingRow, unknown>[] {
  return [
    {
      accessorKey: "parcel",
      header: t("fields.parcelReference"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-mono text-xs font-medium">
            {row.original.parcel}
          </span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {row.original.reference}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "client",
      header: t("fields.client"),
      size: 130,
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("font-medium", clientAccent(row.original.client))}>
          {row.original.client}
        </Badge>
      ),
    },
    {
      accessorKey: "country",
      header: t("fields.country"),
      size: 90,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">{row.original.country}</span>
      ),
    },
    {
      accessorKey: "matchedService",
      header: t("netting.columns.matchedService"),
      cell: ({ row }) => (
        <span className="block truncate text-xs">{row.original.matchedService}</span>
      ),
    },
    {
      accessorKey: "discount",
      header: t("fields.discount"),
      size: 100,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-destructive">{eur(row.original.discount)}</span>
      ),
    },
    {
      accessorKey: "before",
      header: t("netting.columns.freightBefore"),
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {eur(row.original.before)}
        </span>
      ),
    },
    {
      accessorKey: "after",
      header: t("netting.columns.freightAfter"),
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs font-medium tabular-nums">{eur(row.original.after)}</span>
      ),
    },
  ]
}

export default function NettingPage() {
  const { t } = useTranslation("store-pit")
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [country, setCountry] = useState<string>("all")
  const [matched, setMatched] = useState<string>("all")

  const resetPage = () => setPage(0)
  const columns = useMemo(() => buildColumns(t), [t])

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
        title={t("netting.title")}
        description={t("netting.description")}
        actions={
          <span className="text-xs text-muted-foreground">
            {t("netting.matchedCount", {
              matched: count(NETTING_SUMMARY.matched),
              rows: count(NETTING_SUMMARY.rows),
            })}
          </span>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCard label={t("netting.cards.discountLines")} value={count(NETTING_SUMMARY.rows)} />
          <DataCard
            label={t("netting.cards.matched")}
            value={count(NETTING_SUMMARY.matched)}
            tone="success"
          />
          <DataCard
            label={t("netting.cards.unmatched")}
            value={count(NETTING_SUMMARY.unmatched)}
            tone={NETTING_SUMMARY.unmatched > 0 ? "warning" : "success"}
          />
          <DataCard
            label={t("netting.cards.discountTotal")}
            value={eur(NETTING_SUMMARY.discountTotal)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder={t("netting.searchPlaceholder")}
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
              <SelectValue placeholder={t("fields.country")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("netting.filters.allCountries")}</SelectItem>
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
              <SelectValue placeholder={t("netting.filters.matched")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("netting.filters.all")}</SelectItem>
              <SelectItem value="Yes">{t("netting.filters.matchedOnly")}</SelectItem>
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
              {t("actions.reset")}
            </Button>
          ) : null}
          <div className="ml-auto text-xs text-muted-foreground">
            {t("netting.shownCount", {
              shown: count(total),
              total: count(NETTING_SUMMARY.rows),
            })}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.parcel + r.reference}
          emptyState={
            <EmptyState
              icon={SearchX}
              title={t("netting.emptyTitle")}
              description={t("netting.emptyDescription")}
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />

        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          {t("netting.footnote")}
        </p>
      </div>
    </>
  )
}
