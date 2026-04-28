"use client"

import {
  toastApiError,
  useCreateRule,
  useRuleTemplates,
  useRules,
} from "@cortex/api"
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
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowRight,
  Loader2,
  Plus,
  Search,
  ScrollText,
  Sparkles,
} from "lucide-react"
import { formatAbsolute } from "@cortex/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  RULE_CATEGORY_LABEL,
  RULE_STATUS_LABEL,
  RULE_STATUS_TONE,
} from "@/components/rules/labels"

const PAGE_SIZE = 25
const TRIGGER_AUTO: RuleTrigger = "auto_on_extraction"

export default function RulesPage() {
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
        name: tpl?.name ?? "Untitled rule",
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
        header: "Name",
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
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="outline">{RULE_CATEGORY_LABEL[row.original.category]}</Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className={RULE_STATUS_TONE[row.original.status]}>
            {RULE_STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
      {
        id: "version",
        header: "Version",
        cell: ({ row }) => <span className="text-sm">v{row.original.current_version}</span>,
      },
      {
        id: "trigger",
        header: "Trigger",
        cell: ({ row }) => (
          <Badge variant={row.original.trigger === TRIGGER_AUTO ? "default" : "secondary"}>
            {row.original.trigger === TRIGGER_AUTO ? "Auto" : "Manual"}
          </Badge>
        ),
      },
      {
        id: "attached",
        header: "Packages",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.attached_package_count}</span>
        ),
      },
      {
        id: "lastRun",
        header: "Last run",
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
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/idp/rules/${row.original.id}`}>
              Open
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title="Rule editor"
        description="Customs transformations defined in plain language, compiled to Python by AI."
        actions={
          <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                New rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Start from a template</DialogTitle>
                <DialogDescription>
                  Pick a customs preset or start blank. You can edit the natural-language
                  definition in the next step.
                </DialogDescription>
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
                      <CardDescription className="text-xs">
                        {tpl.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className="text-[10px]">
                        {RULE_CATEGORY_LABEL[tpl.category]}
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
                  Or start from scratch.
                </span>
                <Button
                  variant="outline"
                  onClick={() => onCreateFromTemplate(null)}
                  disabled={create.isPending}
                >
                  {create.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : null}
                  Blank rule
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
              placeholder="Search rules…"
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
              <SelectItem value="all">All statuses</SelectItem>
              {RULE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {RULE_STATUS_LABEL[s]}
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
              <SelectItem value="all">All categories</SelectItem>
              {RULE_CATEGORY.map((c) => (
                <SelectItem key={c} value={c}>
                  {RULE_CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? "Refreshing…" : `${total} rules`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={ScrollText}
              title="No rules yet"
              description="Pick a customs preset or write your own in plain language."
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
