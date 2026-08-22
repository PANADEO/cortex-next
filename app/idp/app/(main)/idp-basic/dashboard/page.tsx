"use client"

import {
  getIdpBasicStatusLabel,
  IdpBasicCompletenessBadge,
  IdpBasicStatusBadge,
} from "@/components/idp-basic/status"
import { IdpBasicUploadPackageButton } from "@/components/idp-basic/upload-package-button"
import { idpBasicApi } from "@/lib/idp-basic/api"
import {
  idpBasicQueryKeys,
  useIdpBasicPackages,
  useIdpBasicPollMail,
  useIdpBasicSettings,
  useIdpBasicStats,
} from "@/lib/idp-basic/hooks"
import type {
  IdpBasicPackageListResponse,
  IdpBasicPackageStatus,
  IdpBasicPackageSummary,
  IdpBasicSettings,
} from "@/lib/idp-basic/types"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  PageHeader,
} from "@cortex/ui"
import { cn, formatAbsolute, formatRelative } from "@cortex/utils"
import { keepPreviousData, useQueries, type UseQueryResult } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Columns3,
  FileText,
  FolderInput,
  History,
  Inbox,
  Loader2,
  MailCheck,
  PlayCircle,
  Search,
} from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const BOARD_PAGE_SIZE = 30
const ACTIVE_STATUS_REFETCH_MS = 2_000
const IDLE_STATUS_REFETCH_MS = 10_000

interface BasicBoardColumnMeta {
  id: IdpBasicPackageStatus
  descriptionKey: string
  accent: string
  headerBg: string
  headerText: string
  countBg: string
}

const BASIC_BOARD_COLUMNS: readonly BasicBoardColumnMeta[] = [
  {
    id: "queued",
    descriptionKey: "board.queuedDescription",
    accent: "before:bg-sky-500",
    headerBg: "bg-sky-50 dark:bg-sky-950/40",
    headerText: "text-sky-800 dark:text-sky-200",
    countBg: "bg-sky-500/20 text-sky-900 dark:text-sky-100",
  },
  {
    id: "processing",
    descriptionKey: "board.processingDescription",
    accent: "before:bg-indigo-500",
    headerBg: "bg-indigo-50 dark:bg-indigo-950/40",
    headerText: "text-indigo-800 dark:text-indigo-200",
    countBg: "bg-indigo-500/20 text-indigo-900 dark:text-indigo-100",
  },
  {
    id: "needs_review",
    descriptionKey: "board.needsReviewDescription",
    accent: "before:bg-amber-500",
    headerBg: "bg-amber-50 dark:bg-amber-950/40",
    headerText: "text-amber-800 dark:text-amber-200",
    countBg: "bg-amber-500/20 text-amber-900 dark:text-amber-100",
  },
  {
    id: "ready",
    descriptionKey: "board.readyDescription",
    accent: "before:bg-emerald-500",
    headerBg: "bg-emerald-50 dark:bg-emerald-950/40",
    headerText: "text-emerald-800 dark:text-emerald-200",
    countBg: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
  },
  {
    id: "failed",
    descriptionKey: "board.failedDescription",
    accent: "before:bg-red-500",
    headerBg: "bg-red-50 dark:bg-red-950/40",
    headerText: "text-red-800 dark:text-red-200",
    countBg: "bg-red-500/20 text-red-900 dark:text-red-100",
  },
]

type BasicBoardColumns = Record<IdpBasicPackageStatus, IdpBasicPackageSummary[]>
type StatusCounts = Record<IdpBasicPackageStatus, number>
type PageCounts = Record<IdpBasicPackageStatus, number>
type LoadingByStatus = Record<IdpBasicPackageStatus, boolean>
type PackageListQuery = Parameters<typeof idpBasicApi.packages>[0]

interface BoardPageRequest {
  status: IdpBasicPackageStatus
  pageIndex: number
  offset: number
}

interface BoardState {
  columns: BasicBoardColumns
  totals: StatusCounts
  firstPageLoading: LoadingByStatus
  loadingMore: LoadingByStatus
  isFetching: boolean
}

interface AuditEvent {
  id: string
  packageId: string
  title: string
  description: string
  timestamp: string
  icon: LucideIcon
  iconClassName: string
}

export default function IdpBasicDashboardPage() {
  const { t } = useTranslation(["idp-basic", "common"])
  const [search, setSearch] = useState("")
  const [hiddenStatuses, setHiddenStatuses] = useState<ReadonlySet<IdpBasicPackageStatus>>(
    () => new Set(),
  )
  const [pageCounts, setPageCounts] = useState<PageCounts>(() => initialPageCounts())
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const serverSearch = deferredSearch || undefined

  const stats = useIdpBasicStats()
  const settings = useIdpBasicSettings()
  const recentPackages = useIdpBasicPackages(
    packageListQuery({ limit: 8, offset: 0 }, serverSearch),
  )
  const pollMail = useIdpBasicPollMail()

  useEffect(() => {
    setPageCounts(initialPageCounts())
  }, [serverSearch])

  const visibleMetas = useMemo(
    () => BASIC_BOARD_COLUMNS.filter((meta) => !hiddenStatuses.has(meta.id)),
    [hiddenStatuses],
  )
  const pageRequests = useMemo(
    () => buildPageRequests(visibleMetas, pageCounts),
    [visibleMetas, pageCounts],
  )

  const boardQueries = useQueries({
    queries: pageRequests.map((request) => {
      const query = packageListQuery(
        {
          limit: BOARD_PAGE_SIZE,
          offset: request.offset,
          status: request.status,
        },
        serverSearch,
      )

      return {
        queryKey: idpBasicQueryKeys.packages(query),
        queryFn: () => idpBasicApi.packages(query),
        refetchInterval:
          request.status === "queued" || request.status === "processing"
            ? ACTIVE_STATUS_REFETCH_MS
            : IDLE_STATUS_REFETCH_MS,
        placeholderData: keepPreviousData,
        staleTime: 0,
      }
    }),
  })

  const boardState = buildBoardState(pageRequests, boardQueries)
  const auditEvents = useMemo(
    () => buildAuditEvents(t, recentPackages.data?.items ?? []),
    [t, recentPackages.data?.items],
  )
  const totalOnBoard = visibleMetas.reduce((sum, meta) => sum + boardState.totals[meta.id], 0)

  const handlePoll = async () => {
    try {
      const result = await pollMail.mutateAsync()
      toast.success(t("toast.imported", { count: result.imported }))
    } catch {
      toast.error(t("toast.pollFailed"))
    }
  }

  const handleColumnCheckedChange = (status: IdpBasicPackageStatus, checked: boolean) => {
    setHiddenStatuses((current) => {
      const next = new Set(current)
      if (checked) {
        next.delete(status)
        return next
      }

      const visibleCount = BASIC_BOARD_COLUMNS.length - current.size
      if (visibleCount <= 1) return current
      next.add(status)
      return next
    })
  }

  const handleLoadMore = (status: IdpBasicPackageStatus) => {
    setPageCounts((current) => ({
      ...current,
      [status]: current[status] + 1,
    }))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("dashboard.title")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("dashboard.searchPlaceholder")}
                className="h-9 w-56 pl-9 lg:w-72"
              />
            </div>
            <ColumnVisibilityMenu
              t={t}
              hiddenStatuses={hiddenStatuses}
              onCheckedChange={handleColumnCheckedChange}
            />
            <IdpBasicUploadPackageButton />
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
              {t("actions.pollNow")}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 px-8 py-5">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {boardQueries.some((query) => query.isLoading)
                ? t("common:state.loading")
                : t("dashboard.onBoard", { total: totalOnBoard })}
            </p>
            {boardState.isFetching ? (
              <p className="text-xs text-muted-foreground">{t("state.refreshing")}</p>
            ) : null}
          </div>
          <div className="-mx-2 flex h-[36vh] max-h-[390px] min-h-[260px] gap-3 overflow-x-auto overflow-y-hidden px-2 pb-4">
            {visibleMetas.map((meta) => (
              <BasicKanbanColumn
                key={meta.id}
                t={t}
                meta={meta}
                cards={boardState.columns[meta.id]}
                total={boardState.totals[meta.id]}
                isLoading={boardState.firstPageLoading[meta.id]}
                isLoadingMore={boardState.loadingMore[meta.id]}
                onLoadMore={() => handleLoadMore(meta.id)}
              />
            ))}
          </div>
        </section>

        <section className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_25rem]">
          <Card>
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-sm">{t("dashboard.intakeStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-0 p-0 md:grid-cols-2 xl:grid-cols-4">
              <SystemStatusItem
                icon={Inbox}
                label={t("fields.mailbox")}
                value={t(
                  settings.data?.mailbox_configured ? "intake.connected" : "intake.notConfigured",
                )}
                description={
                  settings.data?.mailbox_configured
                    ? `${settings.data.imap_host ?? "IMAP"} / ${settings.data.imap_mailbox}`
                    : t("intake.mailboxHint")
                }
                tone={settings.data?.mailbox_configured ? "success" : "warning"}
              />
              <SystemStatusItem
                icon={PlayCircle}
                label={t("fields.worker")}
                value={t(settings.data?.worker_enabled ? "intake.enabled" : "intake.disabled")}
                description={
                  settings.data
                    ? t("intake.pollIntervalDescription", {
                        seconds: settings.data.poll_interval_seconds,
                      })
                    : t("intake.loadingSettings")
                }
                tone={settings.data?.worker_enabled ? "success" : "warning"}
              />
              <SystemStatusItem
                icon={FolderInput}
                label={t("fields.filesystem")}
                value={filesystemStatusValue(t, settings.data)}
                description={filesystemStatusDescription(t, settings.data)}
                tone={filesystemStatusTone(settings.data)}
              />
              <SystemStatusItem
                icon={FileText}
                label={t("fields.documents")}
                value={stats.data?.documents_total ?? 0}
                description={t("intake.packagesTotal", {
                  total: stats.data?.packages_total ?? 0,
                })}
                tone="default"
              />
            </CardContent>
          </Card>

          <Card className="flex max-h-80 min-h-0 flex-col overflow-hidden">
            <CardHeader className="shrink-0 border-b border-border px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-muted-foreground" />
                {t("dashboard.auditLog")}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 overflow-y-auto p-0">
              {auditEvents.length > 0 ? (
                <ol className="divide-y divide-border">
                  {auditEvents.map((event) => (
                    <li key={event.id} className="flex gap-3 px-4 py-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          event.iconClassName,
                        )}
                        aria-hidden
                      >
                        <event.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/idp-basic/results/${event.packageId}`}
                            className="text-sm font-medium leading-snug hover:underline"
                          >
                            {event.title}
                          </Link>
                          <time
                            className="shrink-0 text-right text-xs text-muted-foreground"
                            title={formatAbsolute(event.timestamp)}
                          >
                            {formatAbsolute(event.timestamp, "HH:mm")}
                          </time>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  icon={History}
                  title={t("dashboard.auditEmptyTitle")}
                  description={t("dashboard.auditEmptyDescription")}
                />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

function ColumnVisibilityMenu({
  t,
  hiddenStatuses,
  onCheckedChange,
}: {
  t: TFunction<["idp-basic", "common"]>
  hiddenStatuses: ReadonlySet<IdpBasicPackageStatus>
  onCheckedChange: (status: IdpBasicPackageStatus, checked: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9">
          <Columns3 className="mr-1.5 h-3.5 w-3.5" />
          {t("dashboard.columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("dashboard.visibleColumns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {BASIC_BOARD_COLUMNS.map((meta) => (
          <DropdownMenuCheckboxItem
            key={meta.id}
            checked={!hiddenStatuses.has(meta.id)}
            onCheckedChange={(checked) => onCheckedChange(meta.id, checked)}
          >
            {getIdpBasicStatusLabel(t, meta.id)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BasicKanbanColumn({
  t,
  meta,
  cards,
  total,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: {
  t: TFunction<["idp-basic", "common"]>
  meta: BasicBoardColumnMeta
  cards: IdpBasicPackageSummary[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  const hasMore = cards.length < total

  return (
    <section
      className={cn(
        "relative flex h-full min-w-64 flex-[1_1_16rem] flex-col overflow-hidden rounded-xl border border-border bg-muted/30 xl:max-w-[22rem]",
        "before:absolute before:inset-x-0 before:top-0 before:z-20 before:h-1 before:rounded-t-xl before:content-['']",
        meta.accent,
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl px-3 pb-2 pt-3.5",
          meta.headerBg,
        )}
      >
        <div className="min-w-0">
          <h2 className={cn("text-sm font-semibold leading-none", meta.headerText)}>
            {getIdpBasicStatusLabel(t, meta.id)}
          </h2>
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
            {t(meta.descriptionKey)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-semibold",
            meta.countBg,
          )}
        >
          {total}
        </span>
      </header>

      {isLoading ? (
        <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center gap-2 px-3 py-10 text-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("board.loading")}</span>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 px-3 py-8 text-center text-xs text-muted-foreground">
          <Inbox className="h-4 w-4 opacity-50" />
          <span>{t("board.empty")}</span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain p-2">
          {cards.map((card) => (
            <BasicKanbanCard key={card.id} t={t} card={card} />
          ))}
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 h-8 shrink-0"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t("board.loadMore", { loaded: cards.length, total })}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}

function BasicKanbanCard({
  t,
  card,
}: {
  t: TFunction<["idp-basic", "common"]>
  card: IdpBasicPackageSummary
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <article className="rounded-md border border-border bg-card text-left shadow-sm transition hover:border-foreground/20 hover:shadow-md">
      <button
        type="button"
        className="block w-full px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {card.reference_number ?? shortId(card.id)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            {card.document_count}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs font-medium leading-snug text-foreground">
          {card.subject}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <time title={formatAbsolute(card.created_at)}>{formatRelative(card.created_at)}</time>
          <span className="flex items-center gap-1.5">
            {card.alerts.length > 0 ? (
              <AlertTriangle
                className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300"
                aria-label={t("board.hasAlerts")}
              />
            ) : null}
            {card.error_message ? (
              <AlertTriangle
                className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
                aria-label={t("board.processingError")}
              />
            ) : null}
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-border px-2.5 py-2">
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {card.sender || t("board.manualUploadSender")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IdpBasicStatusBadge status={card.status} />
            <IdpBasicCompletenessBadge status={card.completeness_status} />
          </div>
          {card.alerts.length > 0 ? (
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
              {card.alerts[0]}
            </p>
          ) : null}
          {card.error_message ? (
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-destructive">
              {card.error_message}
            </p>
          ) : null}
          <Button asChild size="sm" variant="outline" className="mt-2 h-7 w-full">
            <Link href={`/idp-basic/results/${card.id}`}>{t("board.openResult")}</Link>
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function SystemStatusItem({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  description: string
  tone: "default" | "success" | "warning"
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 md:border-b-0 md:border-r xl:last:border-r-0 md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          tone === "success" && "bg-success/10 text-success",
          tone === "warning" && "bg-warning/10 text-warning",
          tone === "default" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-sm font-semibold",
            tone === "success" && "text-success-foreground",
            tone === "warning" && "text-warning-foreground",
          )}
        >
          {value}
        </p>
        {/* Bez `truncate`: to podpowiedź NIOSĄCA INSTRUKCJĘ, nie komórka tabeli.
            Ucięta do jednej linii gubiła właśnie sedno („…w backendzie id…"),
            i to w obu językach — kontener był za wąski niezależnie od tłumaczenia. */}
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function initialPageCounts(): PageCounts {
  return {
    queued: 1,
    processing: 1,
    ready: 1,
    needs_review: 1,
    failed: 1,
  }
}

function packageListQuery(query: PackageListQuery, search: string | undefined): PackageListQuery {
  return search ? { ...query, search } : query
}

function buildPageRequests(
  visibleMetas: readonly BasicBoardColumnMeta[],
  pageCounts: PageCounts,
): BoardPageRequest[] {
  return visibleMetas.flatMap((meta) =>
    Array.from({ length: pageCounts[meta.id] }, (_, pageIndex) => ({
      status: meta.id,
      pageIndex,
      offset: pageIndex * BOARD_PAGE_SIZE,
    })),
  )
}

function emptyColumns(): BasicBoardColumns {
  return {
    queued: [],
    processing: [],
    ready: [],
    needs_review: [],
    failed: [],
  }
}

function emptyStatusCounts(): StatusCounts {
  return {
    queued: 0,
    processing: 0,
    ready: 0,
    needs_review: 0,
    failed: 0,
  }
}

function emptyLoadingByStatus(): LoadingByStatus {
  return {
    queued: false,
    processing: false,
    ready: false,
    needs_review: false,
    failed: false,
  }
}

function buildBoardState(
  pageRequests: BoardPageRequest[],
  boardQueries: UseQueryResult<IdpBasicPackageListResponse>[],
): BoardState {
  const columns = emptyColumns()
  const totals = emptyStatusCounts()
  const firstPageLoading = emptyLoadingByStatus()
  const loadingMore = emptyLoadingByStatus()
  const seenIds: Record<IdpBasicPackageStatus, Set<string>> = {
    queued: new Set(),
    processing: new Set(),
    ready: new Set(),
    needs_review: new Set(),
    failed: new Set(),
  }

  let isFetching = false

  pageRequests.forEach((request, index) => {
    const query = boardQueries[index]
    if (!query) return

    isFetching = isFetching || query.isFetching
    if (request.pageIndex === 0 && query.isPending) {
      firstPageLoading[request.status] = true
    }
    if (request.pageIndex > 0 && query.isPending) {
      loadingMore[request.status] = true
    }

    const data = query.data
    if (!data) return
    totals[request.status] = data.total

    for (const pkg of data.items) {
      if (seenIds[request.status].has(pkg.id)) continue
      seenIds[request.status].add(pkg.id)
      columns[request.status].push(pkg)
    }
  })

  for (const meta of BASIC_BOARD_COLUMNS) {
    columns[meta.id].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  return { columns, totals, firstPageLoading, loadingMore, isFetching }
}

function shortId(id: string): string {
  const cleaned = id.replace(/^pkg-|^dirty-/, "").replace(/^0+/, "")
  return (cleaned || id).slice(0, 10).toUpperCase()
}

function filesystemStatusValue(
  t: TFunction<["idp-basic", "common"]>,
  settings: IdpBasicSettings | undefined,
): string {
  if (!settings) return t("intake.loading")
  if (!settings.filesystem_enabled) return t("intake.disabled")
  if (!settings.filesystem_watch_dir) return t("intake.missingEnv")
  if (!settings.filesystem_configured) return t("intake.missingFolder")
  return t("intake.watching")
}

function filesystemStatusDescription(
  t: TFunction<["idp-basic", "common"]>,
  settings: IdpBasicSettings | undefined,
): string {
  if (!settings) return t("intake.loadingSettings")
  if (settings.filesystem_watch_dir) {
    return `${settings.filesystem_watch_dir} / ${settings.filesystem_poll_interval_seconds}s`
  }
  return t("intake.setWatchDir")
}

function filesystemStatusTone(
  settings: IdpBasicSettings | undefined,
): "default" | "success" | "warning" {
  if (!settings || !settings.filesystem_enabled) return "default"
  return settings.filesystem_configured ? "success" : "warning"
}

function buildAuditEvents(
  t: TFunction<["idp-basic", "common"]>,
  packages: IdpBasicPackageSummary[],
): AuditEvent[] {
  return packages
    .flatMap((pkg) => {
      const baseDescription = pkg.reference_number
        ? `${pkg.reference_number} - ${pkg.subject}`
        : pkg.subject
      const events: AuditEvent[] = [
        {
          id: `${pkg.id}:created`,
          packageId: pkg.id,
          title: t("audit.packageImported"),
          description: baseDescription,
          timestamp: pkg.created_at,
          icon: Clock3,
          iconClassName: "bg-muted text-muted-foreground",
        },
      ]

      if (pkg.updated_at !== pkg.created_at) {
        events.push({
          id: `${pkg.id}:${pkg.status}`,
          packageId: pkg.id,
          title: statusEventTitle(t, pkg.status),
          description: `${getIdpBasicStatusLabel(t, pkg.status)} - ${baseDescription}`,
          timestamp: pkg.updated_at,
          icon: auditIcon(pkg.status),
          iconClassName: auditIconClassName(pkg.status),
        })
      }

      return events
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8)
}

function statusEventTitle(
  t: TFunction<["idp-basic", "common"]>,
  status: IdpBasicPackageStatus,
): string {
  if (status === "failed") return t("audit.jobFailed")
  if (status === "needs_review") return t("audit.reviewRequired")
  if (status === "ready") return t("audit.jobCompleted")
  if (status === "processing") return t("audit.jobProcessing")
  return t("audit.jobQueued")
}

function auditIcon(status: IdpBasicPackageStatus): LucideIcon {
  if (status === "failed") return AlertTriangle
  if (status === "ready") return CheckCircle2
  if (status === "needs_review") return AlertTriangle
  if (status === "processing") return Loader2
  return Clock3
}

function auditIconClassName(status: IdpBasicPackageStatus): string {
  if (status === "failed") return "bg-destructive/10 text-destructive"
  if (status === "ready") return "bg-success/10 text-success"
  if (status === "needs_review") return "bg-warning/10 text-warning"
  if (status === "processing") return "bg-warning/10 text-warning"
  return "bg-info/10 text-info"
}
