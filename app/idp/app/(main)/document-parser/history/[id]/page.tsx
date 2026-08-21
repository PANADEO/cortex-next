"use client"

import { JobOutcome } from "@/features/document-parser/components/job-outcome"
import { useJob } from "@/features/document-parser/hooks"
import { DEFAULT_EXTRACTION_PROMPT } from "@/lib/document-parser/prompt"
import { Button, Card, CardContent, EmptyState, Label, LoadingState, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { ChevronLeft, FileX } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

export default function DocumentParserJobDetailPage() {
  const { t } = useTranslation("document-parser")
  const params = useParams<{ id: string }>()
  const jobQuery = useJob(params.id ?? null)

  const job = jobQuery.data

  return (
    <>
      <PageHeader
        title={t("detail.title")}
        description={t("detail.description")}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/document-parser/history">
              <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
              {t("detail.backToHistory")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {jobQuery.isLoading ? (
          <LoadingState label={t("detail.loading")} />
        ) : jobQuery.isError || !job ? (
          <EmptyState
            icon={FileX}
            title={t("detail.notFound.title")}
            description={t("detail.notFound.description")}
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
                <dt className="font-medium text-foreground">{t("detail.fields.createdAt")}</dt>
                <dd>{formatAbsolute(job.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.startedAt")}</dt>
                <dd>{job.startedAt ? formatAbsolute(job.startedAt) : "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.completedAt")}</dt>
                <dd>{job.completedAt ? formatAbsolute(job.completedAt) : "—"}</dd>
              </div>
            </dl>

            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <Label>{t("detail.promptLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("detail.promptHint")}</p>
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
