"use client"

// Karta joba trybu "Kilka"/"Pakiet" (design doc §4.1, D4) — pojawia się
// PONIŻEJ formularza (nie nawigacja) z live-updating statusem per pozycja.
// DWA różne renderery zależnie od trybu:
//   - "Kilka" (batch, jeden szablon): płaska lista, każdy wiersz = temat.
//   - "Pakiet" (M szablonów × N tematów): MACIERZ wiersze=tematy,
//     kolumny=szablony — bezpośrednio adresuje to, czego dzisiejszy legacy
//     Streamlit nie miał (płaska lista N×M bez wizualnej struktury
//     kombinacji), design doc §4.1.
// Kliknięcie gotowej/ostrzegawczej/błędnej pozycji otwiera Dialog z pełną
// treścią (+ podświetlenie zakazanych fraz, D5 — ten sam renderer co tryb
// "Pojedyncza", stąd wydzielenie do utils.tsx w tej rundzie).

import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@cortex/ui"
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
import type { GenerationJobDto, GenerationJobItemDto, GenerationJobMode } from "../types"
import { renderHighlightedContent } from "../utils"

function ItemStatusBadge({ status }: { status: GenerationJobItemDto["status"] }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1 font-normal">
          <CircleDashed className="h-3 w-3" />
          Oczekuje
        </Badge>
      )
    case "running":
      return (
        <Badge variant="secondary" className="gap-1 font-normal">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generowanie...
        </Badge>
      )
    case "done":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-3 w-3" />
          Gotowe
        </Badge>
      )
    case "done-with-warnings":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        >
          <AlertTriangle className="h-3 w-3" />
          Zakazane frazy
        </Badge>
      )
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Błąd
        </Badge>
      )
  }
}

function JobSummary({ job }: { job: GenerationJobDto }) {
  const total = job.items.length
  const finished = job.items.filter((item) => item.status !== "pending" && item.status !== "running").length
  return (
    <p className="text-xs text-muted-foreground">
      {job.status === "queued" || job.status === "running"
        ? `Generowanie w toku — ${finished}/${total} gotowych.`
        : job.status === "done"
          ? `Ukończono — ${total}/${total} treści wygenerowanych i zapisanych w archiwum.`
          : `Ukończono z błędami — ${job.items.filter((item) => item.status === "error").length} z ${total} pozycji się nie powiodło.`}
    </p>
  )
}

function isClickable(status: GenerationJobItemDto["status"]): boolean {
  return status === "done" || status === "done-with-warnings" || status === "error"
}

function ItemCell({ item, onSelect }: { item: GenerationJobItemDto; onSelect: () => void }) {
  const clickable = isClickable(item.status)
  return (
    <button
      type="button"
      onClick={clickable ? onSelect : undefined}
      disabled={!clickable}
      className="flex w-full items-center justify-center rounded-md border border-border p-2 disabled:cursor-default enabled:hover:bg-muted/50"
    >
      <ItemStatusBadge status={item.status} />
    </button>
  )
}

interface GenerationJobCardProps {
  job: GenerationJobDto | undefined
  mode: GenerationJobMode
  isLoading: boolean
}

export function GenerationJobCard({ job, mode, isLoading }: GenerationJobCardProps) {
  const [selected, setSelected] = useState<GenerationJobItemDto | null>(null)

  // Macierz wierszy(tematy)/kolumn(szablonów) w kolejności PIERWSZEGO
  // wystąpienia w job.items — items są zbudowane server-side jako iloczyn
  // kartezjański templateIds x topics (jobs/route.ts), więc kolejność jest
  // stabilna i deterministyczna niezależnie od tego, kiedy poszczególne
  // pozycje się kończą.
  const matrix = useMemo(() => {
    if (mode !== "package" || !job) return null
    const topics: string[] = []
    const templates: { templateId: string; templateLabel: string }[] = []
    const seenTemplates = new Set<string>()

    for (const item of job.items) {
      if (!topics.includes(item.topic)) topics.push(item.topic)
      if (!seenTemplates.has(item.templateId)) {
        seenTemplates.add(item.templateId)
        templates.push({ templateId: item.templateId, templateLabel: item.templateLabel })
      }
    }

    const cellFor = (topic: string, templateId: string) =>
      job.items.find((item) => item.topic === topic && item.templateId === templateId)

    return { topics, templates, cellFor }
  }, [mode, job])

  if (isLoading || !job) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <JobSummary job={job} />

      {mode === "batch" || !matrix ? (
        <div className="flex flex-col gap-2">
          {job.items.map((item, index) => (
            <button
              key={`${item.templateId}-${item.topic}-${index}`}
              type="button"
              onClick={isClickable(item.status) ? () => setSelected(item) : undefined}
              disabled={!isClickable(item.status)}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left disabled:cursor-default enabled:hover:bg-muted/50"
            >
              <span className="truncate text-sm">{item.topic}</span>
              <ItemStatusBadge status={item.status} />
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border p-2 text-left font-medium text-muted-foreground">
                  Temat \ Szablon
                </th>
                {matrix.templates.map((template) => (
                  <th
                    key={template.templateId}
                    className="border-b border-border p-2 text-left font-medium text-muted-foreground"
                  >
                    {template.templateLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.topics.map((topic) => (
                <tr key={topic}>
                  <td className="border-b border-border p-2 font-medium">{topic}</td>
                  {matrix.templates.map((template) => {
                    const cell = matrix.cellFor(topic, template.templateId)
                    return (
                      <td key={template.templateId} className="border-b border-border p-2">
                        {cell ? (
                          <ItemCell item={cell} onSelect={() => setSelected(cell)} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.topic}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{selected.templateLabel}</span>
                  <ItemStatusBadge status={selected.status} />
                </div>
                {selected.status === "error" ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {selected.errorMessage ?? "Generowanie tej pozycji się nie powiodło."}
                  </div>
                ) : (
                  <>
                    {selected.status === "done-with-warnings" ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        Treść zawiera frazy z Twojej listy zakazanych fraz mimo automatycznej próby
                        poprawy — zaznaczone poniżej. Popraw ręcznie przed użyciem.
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed">
                      {renderHighlightedContent(selected.content ?? "", selected.matchedForbiddenPhrases ?? [])}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
