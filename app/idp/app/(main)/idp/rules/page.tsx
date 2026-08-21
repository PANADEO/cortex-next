"use client"

import {
  RULE_CATEGORY_LABEL_KEY,
  RULE_STATUS_LABEL_KEY,
  RULE_STATUS_TONE,
} from "@/components/rules/labels"
import { toastApiError, useCreateRule, useRuleTemplates, useRules } from "@cortex/api"
import {
  RULE_CATEGORY,
  RULE_STATUS,
  type RuleCategory,
  type RuleReadModel,
  type RuleStatus,
  type RuleTemplateReadModel,
  type RuleTrigger,
} from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowRight, Loader2, Plus, ScrollText, Search, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const PAGE_SIZE = 25
const TRIGGER_AUTO: RuleTrigger = "auto_on_extraction"

export default function RulesPage() {
  const { t } = useTranslation("idp")
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<RuleStatus | "all">("all")
  const [category, setCategory] = useState<RuleCategory | "all">("all")
  const [search, setSearch] = useState("")
  const [newRuleOpen, setNewRuleOpen] = useState(false)

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: status === "all" ? null : status,
      category: category === "all" ? null : category,
      search: search || null,
    }),
    [page, status, category, search],
  )

  const { data, isLoading, isFetching } = useRules(query)
  const templates = useRuleTemplates()
  const create = useCreateRule()
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onCreateFromTemplate = (tpl: RuleTemplateReadModel | null) => {
    create.mutate(
      {
        name: tpl?.name ?? t("rules.list.untitled"),
        description: tpl?.description ?? null,
        category: tpl?.category ?? "custom",
        tags: tpl?.default_tags ?? [],
        trigger: "manual",
        status: "draft",
      },
      {
        onSuccess: (rule) => {
          setNewRuleOpen(false)
          router.push(`/idp/rules/${rule.id}?nl=${encodeURIComponent(tpl?.example_nl ?? "")}`)
        },
        onError: (err) => toastApiError(err),
      },
    )
  }

  const columns = useMemo<ColumnDef<RuleReadModel>[]>(
    () => [
      {
        id: "name",
        header: t("rules.list.columnName"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {row.original.description ?? "—"}
            </span>
          </div>
        ),
      },
      {
        id: "category",
        header: t("rules.list.columnCategory"),
        cell: ({ row }) => (
          <Badge variant="outline">{t(RULE_CATEGORY_LABEL_KEY[row.original.category])}</Badge>
        ),
      },
      {
        id: "status",
        header: t("rules.list.columnStatus"),
        cell: ({ row }) => (
          <Badge variant="outline" className={RULE_STATUS_TONE[row.original.status]}>
            {t(RULE_STATUS_LABEL_KEY[row.original.status])}
          </Badge>
        ),
      },
      {
        id: "version",
        header: t("rules.list.columnVersion"),
        cell: ({ row }) => <span className="text-sm">v{row.original.current_version}</span>,
      },
      {
        id: "trigger",
        header: t("rules.list.columnTrigger"),
        cell: ({ row }) => (
          <Badge variant={row.original.trigger === TRIGGER_AUTO ? "default" : "secondary"}>
            {row.original.trigger === TRIGGER_AUTO
              ? t("rules.list.triggerAuto")
              : t("rules.list.triggerManual")}
          </Badge>
        ),
      },
      {
        id: "attached",
        header: t("rules.list.columnPackages"),
        cell: ({ row }) => <span className="text-sm">{row.original.attached_package_count}</span>,
      },
      {
        id: "lastRun",
        header: t("rules.list.columnLastRun"),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.last_run_at
              ? formatAbsolute(row.original.last_run_at, "yyyy-MM-dd")
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("rules.list.columnActions")}</span>,
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/idp/rules/${row.original.id}`}>
              {t("rules.list.open")}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ),
      },
    ],
    [t],
  )

  return (
    <>
      <PageHeader
        title={t("rules.list.title")}
        description={t("rules.list.description")}
        actions={
          <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("rules.list.newRule")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t("rules.list.templateDialogTitle")}</DialogTitle>
                <DialogDescription>{t("rules.list.templateDialogDescription")}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {templates.data?.map((tpl) => (
                  <Card
                    key={tpl.id}
                    className="cursor-pointer transition hover:border-primary/40"
                    onClick={() => onCreateFromTemplate(tpl)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{tpl.name}</CardTitle>
                      <CardDescription className="text-xs">{tpl.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className="text-[10px]">
                        {t(RULE_CATEGORY_LABEL_KEY[tpl.category])}
                      </Badge>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        <Sparkles className="mr-1 inline h-3 w-3" />
                        {tpl.example_nl}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("rules.list.orStartFromScratch")}
                </span>
                <Button
                  variant="outline"
                  onClick={() => onCreateFromTemplate(null)}
                  disabled={create.isPending}
                >
                  {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {t("rules.list.blankRule")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("rules.list.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setPage(0)
                setSearch(e.target.value)
              }}
              className="h-9 w-64 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(0)
              setStatus(v as RuleStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("rules.list.allStatuses")}</SelectItem>
              {RULE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(RULE_STATUS_LABEL_KEY[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={category}
            onValueChange={(v) => {
              setPage(0)
              setCategory(v as RuleCategory | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("rules.list.allCategories")}</SelectItem>
              {RULE_CATEGORY.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(RULE_CATEGORY_LABEL_KEY[c])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? t("rules.list.refreshing") : t("rules.list.total", { count: total })}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={ScrollText}
              title={t("rules.list.emptyTitle")}
              description={t("rules.list.emptyDescription")}
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
