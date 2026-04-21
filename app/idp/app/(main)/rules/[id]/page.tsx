"use client"

import {
  toastApiError,
  useCompileRule,
  usePackages,
  usePreviewRule,
  useRule,
  useSaveRuleVersion,
  useUpdateRule,
} from "@cortex/api"
import {
  RULE_CATEGORY,
  RULE_STATUS,
  RULE_TRIGGER,
  type RuleCategory,
  type RuleStatus,
  type RuleTrigger,
} from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cortex/ui"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Loader2,
  PlayCircle,
  Save,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const CATEGORY_LABEL: Record<RuleCategory, string> = {
  transport_allocation: "Transport allocation",
  aggregation: "Aggregation",
  split: "Split",
  lookup: "Lookup",
  currency: "Currency",
  tax: "Tax",
  weight_derivation: "Weight derivation",
  custom: "Custom",
}

const STATUS_LABEL: Record<RuleStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
}

const TRIGGER_LABEL: Record<RuleTrigger, string> = {
  manual: "Manual",
  auto_on_extraction: "Auto on extraction",
}

interface PreviewRow {
  line_number: number
  before: Record<string, string | number | null>
  after: Record<string, string | number | null>
  changed_columns: string[]
}

export default function RuleEditorPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const search = useSearchParams()
  const initialNl = search.get("nl") ?? ""

  const { data: rule, isLoading, error } = useRule(id)
  const update = useUpdateRule(id)
  const compile = useCompileRule()
  const preview = usePreviewRule()
  const saveVersion = useSaveRuleVersion(id)

  const packagesQuery = usePackages({ limit: 20 })

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<RuleCategory>("custom")
  const [status, setStatus] = useState<RuleStatus>("draft")
  const [trigger, setTrigger] = useState<RuleTrigger>("manual")
  const [nl, setNl] = useState("")
  const [pythonCode, setPythonCode] = useState("")
  const [outputColumns, setOutputColumns] = useState<
    { name: string; description: string; data_type: "string" | "number" | "boolean" | "date" }[]
  >([])
  const [versionNotes, setVersionNotes] = useState("")
  const [samplePackageId, setSamplePackageId] = useState("")
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewMeta, setPreviewMeta] = useState<{
    added: string[]
    warnings: string[]
    errors: string[]
  } | null>(null)

  useEffect(() => {
    if (!rule) return
    const v = rule.versions[0]
    setName(rule.name)
    setDescription(rule.description ?? "")
    setCategory(rule.category)
    setStatus(rule.status)
    setTrigger(rule.trigger)
    setNl(v?.nl_definition ?? initialNl)
    setPythonCode(v?.python_code ?? "")
    setOutputColumns(v?.output_columns ?? [])
  }, [rule, initialNl])

  useEffect(() => {
    if (samplePackageId) return
    const first = packagesQuery.data?.items[0]
    if (first) setSamplePackageId(first.id)
  }, [packagesQuery.data, samplePackageId])

  const headerDirty = useMemo(() => {
    if (!rule) return false
    return (
      name !== rule.name ||
      description !== (rule.description ?? "") ||
      category !== rule.category ||
      status !== rule.status ||
      trigger !== rule.trigger
    )
  }, [rule, name, description, category, status, trigger])

  const versionDirty = useMemo(() => {
    if (!rule) return Boolean(nl || pythonCode)
    const v = rule.versions[0]
    if (!v) return Boolean(nl || pythonCode)
    return nl !== v.nl_definition || pythonCode !== v.python_code
  }, [rule, nl, pythonCode])

  if (isLoading) return <LoadingState label="Loading rule…" />
  if (error || !rule) {
    return <ErrorState title="Rule not found" message="It may have been removed." />
  }

  const runCompile = () => {
    if (!nl.trim()) {
      toast.error("Add a natural-language definition first.")
      return
    }
    compile.mutate(
      {
        nl_definition: nl,
        rule_id: rule.id,
        sample_package_id: samplePackageId || null,
      },
      {
        onSuccess: (res) => {
          setPythonCode(res.python_code)
          setOutputColumns(res.output_columns)
          if (res.warnings.length) toast.warning(res.warnings.join("; "))
          else toast.success("Compiled. Review the Python and run a preview.")
        },
        onError: (err) => toastApiError(err),
      },
    )
  }

  const runPreview = () => {
    if (!samplePackageId) {
      toast.error("Select a sample package.")
      return
    }
    if (!pythonCode.trim()) {
      toast.error("Compile the rule first.")
      return
    }
    preview.mutate(
      { python_code: pythonCode, sample_package_id: samplePackageId },
      {
        onSuccess: (res) => {
          setPreviewRows(res.rows)
          setPreviewMeta({
            added: res.added_columns,
            warnings: res.warnings,
            errors: res.errors,
          })
        },
        onError: (err) => toastApiError(err),
      },
    )
  }

  const saveHeader = () => {
    update.mutate(
      {
        name,
        description: description || null,
        category,
        tags: rule.tags,
        customer_tag: rule.customer_tag,
        trigger,
        status,
      },
      {
        onSuccess: () => toast.success("Rule metadata saved."),
        onError: (err) => toastApiError(err),
      },
    )
  }

  const persistVersion = () => {
    if (!pythonCode.trim()) {
      toast.error("Cannot save without compiled Python code.")
      return
    }
    saveVersion.mutate(
      {
        nl_definition: nl,
        python_code: pythonCode,
        output_columns: outputColumns,
        notes: versionNotes || null,
      },
      {
        onSuccess: (v) => {
          toast.success(`Saved as v${v.version}`)
          setVersionNotes("")
        },
        onError: (err) => toastApiError(err),
      },
    )
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/rules">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-[280px] font-medium"
          />
          <Badge variant="outline">v{rule.current_version || "—"}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={saveHeader}
            disabled={!headerDirty || update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save metadata
          </Button>
          <Button
            size="sm"
            onClick={persistVersion}
            disabled={!versionDirty || saveVersion.isPending}
          >
            {saveVersion.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save as v{(rule.versions[0]?.version ?? 0) + 1}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-6 py-4">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Category
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as RuleCategory)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_CATEGORY.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RuleStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Default trigger
              </Label>
              <Select value={trigger} onValueChange={(v) => setTrigger(v as RuleTrigger)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TRIGGER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRIGGER_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Description
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9"
                placeholder="Short summary"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">
                <Sparkles className="mr-1.5 inline h-4 w-4 text-primary" />
                Natural language
              </CardTitle>
              <Button
                size="sm"
                onClick={runCompile}
                disabled={compile.isPending || !nl.trim()}
              >
                {compile.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="mr-1.5 h-3.5 w-3.5" />
                )}
                Compile with AI
              </Button>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <Textarea
                value={nl}
                onChange={(e) => setNl(e.target.value)}
                rows={6}
                placeholder="Opisz transformację po polsku lub angielsku — np. 'Rozdziel koszt frachtu z transport_info.cost proporcjonalnie do wagi netto każdej pozycji.'"
                className="font-sans text-sm"
              />
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Generated Python
                </Label>
                <Textarea
                  readOnly
                  value={pythonCode}
                  rows={12}
                  placeholder="# Compile the rule to see generated Python here."
                  className="font-mono text-xs"
                />
              </div>
              {outputColumns.length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    New columns
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {outputColumns.map((c) => (
                      <Badge key={c.name} variant="outline">
                        <code className="text-[11px]">{c.name}</code>
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {c.data_type}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Version notes (optional)
                </Label>
                <Input
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="What changed in this version?"
                  className="h-8"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">
                <PlayCircle className="mr-1.5 inline h-4 w-4 text-primary" />
                Preview on sample
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={samplePackageId} onValueChange={setSamplePackageId}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Pick package…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(packagesQuery.data?.items ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.file_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runPreview}
                  disabled={preview.isPending || !pythonCode}
                >
                  {preview.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Run dry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {previewRows.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Compile the rule and run a preview to see before/after.
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-3">
                    {previewMeta?.added.length ? (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Added columns:</span>{" "}
                        {previewMeta.added.map((c) => (
                          <Badge key={c} variant="outline" className="mr-1 font-mono text-[10px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {previewMeta?.warnings.length ? (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
                        ⚠ {previewMeta.warnings.join("; ")}
                      </div>
                    ) : null}
                    {previewMeta?.errors.length ? (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                        {previewMeta.errors.join("; ")}
                      </div>
                    ) : null}
                    <table className="w-full text-xs">
                      <thead className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5">Line</th>
                          <th className="px-2 py-1.5">Field</th>
                          <th className="px-2 py-1.5">Before</th>
                          <th className="px-2 py-1.5">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewRows.flatMap((row) => {
                          const keys = Array.from(
                            new Set([
                              ...Object.keys(row.before),
                              ...Object.keys(row.after),
                            ]),
                          )
                          return keys.map((k) => {
                            const changed = row.changed_columns.includes(k)
                            return (
                              <tr key={`${row.line_number}-${k}`} className={changed ? "bg-emerald-500/5" : ""}>
                                <td className="px-2 py-1 font-mono text-[10px]">{row.line_number}</td>
                                <td className="px-2 py-1 font-mono text-[10px]">{k}</td>
                                <td className="px-2 py-1">{String(row.before[k] ?? "—")}</td>
                                <td className="px-2 py-1 font-medium">
                                  {String(row.after[k] ?? "—")}
                                </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <GitBranch className="mr-1.5 inline h-4 w-4" />
              Version history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rule.versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No versions yet. Compile and save your first version above.
              </p>
            ) : (
              <ul className="space-y-2">
                {rule.versions.map((v) => (
                  <li
                    key={v.version}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === rule.current_version ? "default" : "outline"}>
                          v{v.version}
                        </Badge>
                        {v.version === rule.current_version ? (
                          <span className="inline-flex items-center text-[11px] text-emerald-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> current
                          </span>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()} · {v.created_by}
                        </span>
                      </div>
                      <p className="line-clamp-2 max-w-2xl text-xs text-muted-foreground">
                        {v.nl_definition}
                      </p>
                      {v.notes ? (
                        <p className="text-[11px] italic text-muted-foreground">{v.notes}</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNl(v.nl_definition)
                        setPythonCode(v.python_code)
                        setOutputColumns(v.output_columns)
                        toast.success(`Loaded v${v.version} into editor`)
                      }}
                    >
                      Load
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
