"use client"

import { formatFileSizeBytes } from "@cortex/utils"
import { Badge, Button, ErrorState, LoadingState } from "@cortex/ui"
import { Download, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { errorMessageFor, STATUS_BADGE_VARIANT, STATUS_LABELS } from "../status"
import type { DocumentParserJob } from "../types"
import { DocumentParserMarkdown } from "./markdown"

/** Wywołuje pobranie wyniku jako plik .md — bez żadnego zapytania sieciowego,
 *  treść już jest na kliencie (job.markdown). D5: to jedyna forma "pliku" w
 *  tym module — oryginał nigdy nie jest trwale przechowywany. */
function downloadMarkdown(job: DocumentParserJob): void {
  const blob = new Blob([job.markdown ?? ""], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${job.fileName.replace(/\.[^./]+$/, "")}.md`
  link.click()
  URL.revokeObjectURL(url)
}

interface JobOutcomeProps {
  job: DocumentParserJob
  /** Podana WYŁĄCZNIE na ekranie uploadu (D1) — link "zobacz pełny wynik" do
   *  /document-parser/history/[id]. Ekran szczegółów sam JEST tym pełnym
   *  widokiem, więc tam ten prop zostaje pominięty. */
  detailsHref?: string
  /** Podgląd skrócony (ekran uploadu) kontra pełny (ekran szczegółów) — D1:
   *  karta joba na uploadzie ma "skrócony podgląd Markdown". */
  previewOnly?: boolean
}

export function JobOutcome({ job, detailsHref, previewOnly = false }: JobOutcomeProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate text-sm font-medium">{job.fileName}</span>
        <Badge variant={STATUS_BADGE_VARIANT[job.status]}>{STATUS_LABELS[job.status]}</Badge>
        <span className="text-xs text-muted-foreground">{formatFileSizeBytes(job.fileSizeBytes)}</span>
      </div>

      {(job.status === "queued" || job.status === "processing") && (
        <LoadingState
          label={
            job.status === "queued"
              ? "Zadanie czeka w kolejce…"
              : "Trwa przetwarzanie dokumentu — konwersja, render stron i ekstrakcja przez model wizyjny…"
          }
        />
      )}

      {job.status === "error" &&
        (() => {
          const { title, hint } = errorMessageFor(job.errorCode, job.errorMessage)
          return <ErrorState title={title} message={hint} />
        })()}

      {job.status === "done" && (
        <div className="flex flex-col gap-3">
          {job.truncated ? (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Dokument ma więcej stron niż limit przetwarzania — wynik obejmuje tylko pierwsze{" "}
                {job.pageCount} {job.pageCount === 1 ? "stronę" : "stron"}.
              </span>
            </div>
          ) : null}

          <div
            className={
              previewOnly
                ? "max-h-64 overflow-y-auto rounded-md border border-border bg-card p-4 text-sm"
                : "rounded-md border border-border bg-card p-4 text-sm"
            }
          >
            <DocumentParserMarkdown content={job.markdown ?? ""} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <dt className="font-medium text-foreground">Strony</dt>
              <dd>{job.pageCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Obrazy</dt>
              <dd>{job.imageCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Model</dt>
              {/* `|| "—"`, nie `??`: backend zwraca "" (nie null), gdy żaden
                  model wizyjny nie został rozwiązany (DOCUMENT_PARSER_VISION_MODEL
                  nieustawione, D7/Q3) — potwierdzone realnym round-tripem. */}
              <dd className="truncate">{job.model || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Czas przetwarzania</dt>
              <dd>{job.elapsedSeconds != null ? `${job.elapsedSeconds.toFixed(1)} s` : "—"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => downloadMarkdown(job)}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Pobierz Markdown
            </Button>
            {detailsHref ? (
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={detailsHref}>Zobacz pełny wynik</Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
