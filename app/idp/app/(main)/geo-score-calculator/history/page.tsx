"use client"

// Historia (design doc §4.2) — zastępuje dashboard+inline-detail legacy
// Streamlita (§1.4/§1.5) `CortexDataGrid`-em: kolumny data/podgląd/wynik/
// ocena/słowa, wyszukiwanie wbudowane w grid, filtr oceny jako `Select` nad
// tabelą, jedna dominująca akcja wiersza (ChevronRight, code-ui "row-actions,
// nie klik-w-wiersz"). Pasek KPI (liczba/średnia/trend) i eksport całości nad
// tabelą.

import { downloadHistoryExport } from "@/features/geo-score-calculator/export"
import { computeHistoryStats } from "@/features/geo-score-calculator/history-stats"
import { useMyGeoScoreHistory } from "@/features/geo-score-calculator/hooks"
import type {
  GeoScoreCalculationSummaryDto,
  GeoScoreGrade,
} from "@/features/geo-score-calculator/types"
import {
  Badge,
  Button,
  CortexDataGrid,
  DataCard,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Label,
  LoadingState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { cn, formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import {
  BarChart3,
  ChevronRight,
  Download,
  FileSearch,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

// Same WARTOŚCI filtra — napis opcji powstaje z tłumaczenia przy renderze,
// bo litera oceny jest danymi, a nie częścią zdania do przetłumaczenia.
const GRADE_FILTER_VALUES = ["all", "A", "B", "C", "D", "F"] as const

const GRADE_BADGE_TONE: Record<GeoScoreGrade, string> = {
  A: "border-success/40 bg-success/10 text-success",
  B: "border-success/40 bg-success/10 text-success",
  C: "border-warning/40 bg-warning/10 text-warning",
  D: "border-warning/40 bg-warning/10 text-warning",
  F: "border-destructive/40 bg-destructive/10 text-destructive",
}

// Referencja stabilna między renderami — inaczej `historyQuery.data ?? []`
// tworzyłby nową tablicę za każdym razem, unieważniając poniższy useMemo.
const EMPTY_HISTORY: GeoScoreCalculationSummaryDto[] = []

export default function GeoScoreCalculatorHistoryPage() {
  const { t } = useTranslation("geo-score-calculator")
  const router = useRouter()
  const historyQuery = useMyGeoScoreHistory()
  const [gradeFilter, setGradeFilter] = useState<GeoScoreGrade | "all">("all")

  const rows = historyQuery.data ?? EMPTY_HISTORY
  const filtered = useMemo(
    () => (gradeFilter === "all" ? rows : rows.filter((row) => row.grade === gradeFilter)),
    [rows, gradeFilter],
  )
  const stats = useMemo(() => computeHistoryStats(rows), [rows])

  const columns: ColumnDef<GeoScoreCalculationSummaryDto, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "createdAt",
        header: t("history.columns.date"),
        enableSorting: true,
        cell: ({ row }) => formatAbsolute(row.original.createdAt),
      },
      {
        accessorKey: "textPreview",
        header: t("history.columns.preview"),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-md">{row.original.textPreview}</span>
        ),
      },
      {
        accessorKey: "totalScore",
        header: t("history.columns.score"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.totalScore.toFixed(1)}</span>
        ),
      },
      {
        accessorKey: "grade",
        header: t("history.columns.grade"),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant="outline" className={cn(GRADE_BADGE_TONE[row.original.grade])}>
            {row.original.grade}
          </Badge>
        ),
      },
      {
        accessorKey: "wordCount",
        header: t("history.columns.words"),
        enableSorting: true,
        cell: ({ row }) => row.original.wordCount,
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("history.columns.viewDetailsAria", {
                date: formatAbsolute(row.original.createdAt),
              })}
              onClick={() => router.push(`/geo-score-calculator/history/${row.original.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router, t],
  )

  return (
    <>
      <PageHeader
        title={t("history.title")}
        description={t("history.description")}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={rows.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("history.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadHistoryExport(rows, "csv")}>
                {t("history.exportCsv")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadHistoryExport(rows, "json")}>
                {t("history.exportJson")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <DataCard
            label={t("history.stats.count")}
            value={stats.count}
            icon={FileText}
            isLoading={historyQuery.isLoading}
          />
          <DataCard
            label={t("history.stats.average")}
            value={stats.averageScore !== null ? stats.averageScore.toFixed(1) : "—"}
            icon={BarChart3}
            isLoading={historyQuery.isLoading}
          />
          <DataCard
            label={t("history.stats.trend")}
            value={
              stats.trend
                ? `${stats.trend.direction === "up" ? "+" : ""}${stats.trend.delta.toFixed(1)}`
                : "—"
            }
            description={
              stats.trend
                ? t("history.stats.trendNewerVsOlder")
                : rows.length < 2
                  ? t("history.stats.trendNotEnough")
                  : t("history.stats.trendNoChange")
            }
            icon={stats.trend?.direction === "down" ? TrendingDown : TrendingUp}
            tone={
              stats.trend ? (stats.trend.direction === "up" ? "success" : "destructive") : "default"
            }
            isLoading={historyQuery.isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="geo-score-grade-filter" className="text-xs text-muted-foreground">
            {t("history.gradeFilterLabel")}
          </Label>
          <Select
            value={gradeFilter}
            onValueChange={(value) => setGradeFilter(value as GeoScoreGrade | "all")}
          >
            <SelectTrigger id="geo-score-grade-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADE_FILTER_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "all"
                    ? t("history.gradeFilter.all")
                    : t("history.gradeFilter.grade", { grade: value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {historyQuery.isLoading ? (
          <LoadingState label={t("history.loading")} />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={filtered}
            bordered
            searchable
            searchPlaceholder={t("history.searchPlaceholder")}
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={FileSearch}
                title={t("history.emptyTitle")}
                description={t("history.emptyDescription")}
              />
            }
          />
        )}
      </div>
    </>
  )
}
