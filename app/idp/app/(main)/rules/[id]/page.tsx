"use client"

import {
  toastApiError,
  useCompileRule,
  useExplainRule,
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
  type ExplainRuleResponse,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@cortex/ui"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  GitBranch,
  Lightbulb,
  Loader2,
  PlayCircle,
  Save,
  Sparkles,
} from "lucide-react"
import { formatAbsolute } from "@cortex/utils"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  hasMeaningfulNl,
  RULE_CATEGORY_LABEL,
  RULE_STATUS_LABEL,
  RULE_TRIGGER_LABEL,
} from "@/components/rules/labels"

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
  const explain = useExplainRule()
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
  const [explanation, setExplanation] = useState<ExplainRuleResponse | null>(null)
  const [showPython, setShowPython] = useState(false)
  const [tab, setTab] = useState("definition")
  const explainTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const explainSeq = useRef(0)
  const initializedId = useRef<string | null>(null)

  // Seed editor state once per rule id — background refetches must not clobber user edits.
  useEffect(() => {
    if (!rule || initializedId.current === rule.id) return
    initializedId.current = rule.id
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

  useEffect(
    () => () => {
      if (explainTimer.current) clearTimeout(explainTimer.current)
    },
    [],
  )

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

  if (isLoading) return <LoadingState label="Ładuję regułę…" />
  if (error || !rule) {
    return <ErrorState title="Nie znaleziono reguły" message="Mogła zostać usunięta." />
  }

  const triggerExplain = (text: string) => {
    if (explainTimer.current) clearTimeout(explainTimer.current)
    if (!hasMeaningfulNl(text)) {
      setExplanation(null)
      return
    }
    explainTimer.current = setTimeout(() => {
      const seq = ++explainSeq.current
      explain.mutate(
        { nl_definition: text, rule_id: rule.id, sample_package_id: samplePackageId || null },
        {
          onSuccess: (res) => {
            if (seq === explainSeq.current) setExplanation(res)
          },
        },
      )
    }, 400)
  }

  const runCompile = () => {
    if (!nl.trim()) {
      toast.error("Najpierw dodaj definicję w naturalnym języku.")
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
          setShowPython(true)
          if (res.warnings.length) toast.warning(res.warnings.join("; "))
          else toast.success("Skompilowano. Przejdź do zakładki Symulacja, żeby przetestować.")
        },
        onError: (err) => toastApiError(err),
      },
    )
  }

  const runPreview = () => {
    if (!samplePackageId) {
      toast.error("Wybierz paczkę próbną.")
      return
    }
    if (!pythonCode.trim()) {
      toast.error("Najpierw skompiluj regułę (zakładka Definicja).")
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
        onSuccess: () => toast.success("Metadane reguły zapisane."),
        onError: (err) => toastApiError(err),
      },
    )
  }

  const persistVersion = () => {
    if (!pythonCode.trim()) {
      toast.error("Najpierw skompiluj regułę.")
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
          toast.success(`Zapisano jako v${v.version}`)
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
              Wstecz
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
            Zapisz metadane
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
            Zapisz jako v{(rule.versions[0]?.version ?? 0) + 1}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-6 py-4">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Kategoria
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as RuleCategory)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_CATEGORY.map((c) => (
                    <SelectItem key={c} value={c}>
                      {RULE_CATEGORY_LABEL[c]}
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
                      {RULE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Domyślny trigger
              </Label>
              <Select value={trigger} onValueChange={(v) => setTrigger(v as RuleTrigger)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TRIGGER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RULE_TRIGGER_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Opis
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9"
                placeholder="Krótkie podsumowanie"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="definition">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Definicja
            </TabsTrigger>
            <TabsTrigger value="simulation">
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
              Symulacja
            </TabsTrigger>
            <TabsTrigger value="versions">
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />
              Wersje
            </TabsTrigger>
          </TabsList>

          <TabsContent value="definition" className="flex-1">
            <div className="grid h-full gap-4 lg:grid-cols-2">
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <Sparkles className="mr-1.5 inline h-4 w-4 text-primary" />
                    Reguła w naturalnym języku
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <Textarea
                    value={nl}
                    onChange={(e) => {
                      setNl(e.target.value)
                      triggerExplain(e.target.value)
                    }}
                    onBlur={() => triggerExplain(nl)}
                    rows={10}
                    placeholder={
                      "Opisz transformację po polsku lub angielsku.\n\n" +
                      "Przykład: 'Rozdziel koszt frachtu z transport_info.cost\nproporcjonalnie do wagi netto każdej pozycji faktury.'"
                    }
                    className="font-sans text-sm"
                  />
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Notatka do wersji (opcjonalne)
                    </Label>
                    <Input
                      value={versionNotes}
                      onChange={(e) => setVersionNotes(e.target.value)}
                      placeholder="Co się zmieniło w tej wersji?"
                      className="h-8"
                    />
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 self-start rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                    onClick={() => setShowPython((v) => !v)}
                  >
                    {showPython ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Code2 className="h-3 w-3" />
                    Zaawansowane — wygenerowany Python
                  </button>

                  {showPython ? (
                    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Skompilowany kod (tylko do odczytu)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px]"
                          onClick={runCompile}
                          disabled={compile.isPending || !nl.trim()}
                        >
                          {compile.isPending ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Code2 className="mr-1 h-3 w-3" />
                          )}
                          Kompiluj ponownie
                        </Button>
                      </div>
                      <Textarea
                        readOnly
                        value={pythonCode}
                        rows={10}
                        placeholder="# Kliknij 'Kompiluj ponownie', żeby wygenerować Python z definicji."
                        className="font-mono text-[11px]"
                      />
                      {outputColumns.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {outputColumns.map((c) => (
                            <Badge key={c.name} variant="outline" className="text-[10px]">
                              <code>{c.name}</code>
                              <span className="ml-1 text-muted-foreground">{c.data_type}</span>
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">
                    <Lightbulb className="mr-1.5 inline h-4 w-4 text-amber-500" />
                    Co AI rozumie
                  </CardTitle>
                  {explain.isPending ? (
                    <span className="inline-flex items-center text-[11px] text-muted-foreground">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Analizuję…
                    </span>
                  ) : null}
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ExplanationPanel
                    data={explanation}
                    pending={explain.isPending}
                    hasNl={hasMeaningfulNl(nl)}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="simulation" className="flex-1">
            <Card className="flex h-full flex-col">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">
                  <PlayCircle className="mr-1.5 inline h-4 w-4 text-primary" />
                  Symulacja na danych
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={samplePackageId} onValueChange={setSamplePackageId}>
                    <SelectTrigger className="h-8 w-[220px] text-xs">
                      <SelectValue placeholder="Wybierz paczkę…" />
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
                    onClick={runPreview}
                    disabled={preview.isPending || !pythonCode}
                  >
                    {preview.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Testowy przebieg
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {!pythonCode ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <CircleHelp className="h-8 w-8" />
                    <p>Najpierw skompiluj regułę w zakładce Definicja.</p>
                  </div>
                ) : previewRows.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Wybierz paczkę i kliknij „Testowy przebieg”, żeby zobaczyć przed/po.
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="space-y-3">
                      {previewMeta?.added.length ? (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Nowe kolumny:</span>{" "}
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
                            <th className="px-2 py-1.5">Linia</th>
                            <th className="px-2 py-1.5">Pole</th>
                            <th className="px-2 py-1.5">Przed</th>
                            <th className="px-2 py-1.5">Po</th>
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
          </TabsContent>

          <TabsContent value="versions" className="flex-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  <GitBranch className="mr-1.5 inline h-4 w-4" />
                  Historia wersji
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rule.versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Jeszcze brak wersji. Skompiluj i zapisz pierwszą.
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
                                <CheckCircle2 className="mr-1 h-3 w-3" /> aktualna
                              </span>
                            ) : null}
                            <span className="text-[11px] text-muted-foreground">
                              {formatAbsolute(v.created_at)} · {v.created_by}
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
                            setTab("definition")
                            triggerExplain(v.nl_definition)
                            toast.success(`Załadowano v${v.version}`)
                          }}
                        >
                          Załaduj
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function ExplanationPanel({
  data,
  pending,
  hasNl,
}: {
  data: ExplainRuleResponse | null
  pending: boolean
  hasNl: boolean
}) {
  if (!hasNl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Lightbulb className="h-8 w-8 text-muted-foreground/60" />
        <p className="max-w-sm">
          Zacznij pisać regułę po lewej. AI w locie podsumuje co robi i zaproponuje
          przykład na konkretnych liczbach.
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {pending ? "Analizuję…" : "Wpisz przynajmniej kilka słów."}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-3">
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            data.is_valid
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800"
          }`}
        >
          {data.is_valid ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{data.summary}</span>
        </div>

        {data.worked_example ? (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Przykład na liczbach
            </span>
            <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
              {data.worked_example}
            </p>
          </div>
        ) : null}

        {data.affected_columns.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Kolumny które się pojawią / zmienią
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.affected_columns.map((c) => (
                <Badge key={c} variant="outline" className="font-mono text-[10px]">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {data.concerns.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-amber-700">
              Założenia / uwagi
            </span>
            <ul className="space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs">
              {data.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-600">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.clarifying_questions.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Pytania doprecyzowujące
            </span>
            <ul className="space-y-1 text-xs">
              {data.clarifying_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                  <CircleHelp className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  )
}
