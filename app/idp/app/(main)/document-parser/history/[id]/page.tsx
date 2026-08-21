"use client"

import { JobOutcome } from "@/features/document-parser/components/job-outcome"
import { useJob } from "@/features/document-parser/hooks"
import { DEFAULT_EXTRACTION_PROMPT } from "@/lib/document-parser/prompt"
import { Button, Card, CardContent, EmptyState, Label, LoadingState, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { ChevronLeft, FileX } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

export default function DocumentParserJobDetailPage() {
  const params = useParams<{ id: string }>()
  const jobQuery = useJob(params.id ?? null)

  const job = jobQuery.data

  return (
    <>
      <PageHeader
        title="Szczegóły zadania"
        description="Pełny wynik ekstrakcji, metadane i (dla zadań zakończonych błędem) pełny komunikat."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/document-parser/history">
              <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
              Historia
            </Link>
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {jobQuery.isLoading ? (
          <LoadingState label="Wczytywanie zadania…" />
        ) : jobQuery.isError || !job ? (
          <EmptyState
            icon={FileX}
            title="Nie znaleziono zadania"
            description="Zadanie nie istnieje albo nie masz do niego dostępu."
          />
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <JobOutcome job={job} />
              </CardContent>
            </Card>

            <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
              <div>
                <dt className="font-medium text-foreground">Wgrano</dt>
                <dd>{formatAbsolute(job.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Rozpoczęto</dt>
                <dd>{job.startedAt ? formatAbsolute(job.startedAt) : "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Zakończono</dt>
                <dd>{job.completedAt ? formatAbsolute(job.completedAt) : "—"}</dd>
              </div>
            </dl>

            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <Label>Prompt użyty do ekstrakcji</Label>
                <p className="text-xs text-muted-foreground">
                  Jeden, wbudowany prompt dla wszystkich zadań w tej wersji modułu — przydatny przy
                  ocenie jakości wyniku powyżej.
                </p>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
                  {DEFAULT_EXTRACTION_PROMPT}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
