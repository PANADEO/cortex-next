"use client"

// Szczegóły wpisu archiwum (design doc §4.5, Round D) — pełna wygenerowana
// treść + metadane generacji + podświetlenie zakazanych fraz (ten sam
// `renderHighlightedContent` co ekran generowania i karta joba, D5 pkt 2:
// user MUSI świadomie zobaczyć trafienie). PER-USER: 404 z API (guard w
// archive/[id]/route.ts, nie tutaj) renderuje się jako EmptyState, nigdy
// awaria strony — code-service "Rekordy per-user" pkt 2 (nigdy 403, nigdy
// wyciek istnienia cudzego wpisu).

import {
  useArchiveEntry,
  useMyClientProfiles,
  useMyMarketProfiles,
} from "@/features/content-guru/hooks"
import { ContentStatusBadge, renderHighlightedContent } from "@/features/content-guru/utils"
import { Button, Card, CardContent, EmptyState, LoadingState, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { ChevronLeft, FileX } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

// Tryb zapisany w metadanych to identyfikator, nie napis — mapa wskazuje
// klucz tłumaczenia, a nieznana wartość zostaje pokazana surowo.
const GENERATION_MODE_KEY: Record<string, string> = {
  single: "modes.single",
  batch: "modes.batch",
  package: "modes.package",
}

export default function ContentGuruHistoryDetailPage() {
  const { t } = useTranslation("content-guru")
  const params = useParams<{ id: string }>()
  const entryQuery = useArchiveEntry(params.id ?? null)
  // Profile są per-user i już listowane gdzie indziej w module — reużywamy
  // te same zapytania (TanStack Query cache) żeby zamienić
  // clientProfileId/marketProfileId na czytelną nazwę zamiast surowego uuid.
  const clientProfilesQuery = useMyClientProfiles()
  const marketProfilesQuery = useMyMarketProfiles()

  const entry = entryQuery.data

  const clientProfileName = useMemo(() => {
    if (!entry?.clientProfileId) return null
    return (
      clientProfilesQuery.data?.find((profile) => profile.id === entry.clientProfileId)
        ?.profileName ?? null
    )
  }, [entry, clientProfilesQuery.data])

  const marketProfileName = useMemo(() => {
    if (!entry?.marketProfileId) return null
    return (
      marketProfilesQuery.data?.find((profile) => profile.id === entry.marketProfileId)
        ?.profileName ?? null
    )
  }, [entry, marketProfilesQuery.data])

  const generationMode =
    entry && typeof entry.metadata.generationMode === "string"
      ? entry.metadata.generationMode
      : null
  const jobId = entry && typeof entry.metadata.jobId === "string" ? entry.metadata.jobId : null

  return (
    <>
      <PageHeader
        title={t("detail.title")}
        description={t("detail.description")}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/content-guru/history">
              <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
              {t("detail.backToHistory")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {entryQuery.isLoading ? (
          <LoadingState label={t("detail.loading")} />
        ) : entryQuery.isError || !entry ? (
          <EmptyState
            icon={FileX}
            title={t("detail.notFound.title")}
            description={t("detail.notFound.description")}
          />
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ContentStatusBadge status={entry.status} />
                    <span className="text-sm font-medium">{entry.contentType}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.modelUsed}</span>
                </div>

                {entry.status === "done-with-warnings" ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {t("detail.forbiddenWarning")}
                  </div>
                ) : null}

                <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed">
                  {renderHighlightedContent(
                    entry.generatedContent,
                    entry.matchedForbiddenPhrases ?? [],
                  )}
                </div>
              </CardContent>
            </Card>

            <dl className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.createdAt")}</dt>
                <dd>{formatAbsolute(entry.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.topic")}</dt>
                <dd>{entry.topic ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.targetAudience")}</dt>
                <dd>{entry.targetAudience ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.generationMode")}</dt>
                <dd>
                  {generationMode
                    ? GENERATION_MODE_KEY[generationMode]
                      ? t(GENERATION_MODE_KEY[generationMode]!)
                      : generationMode
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.clientProfile")}</dt>
                <dd>{clientProfileName ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t("detail.fields.marketProfile")}</dt>
                <dd>{marketProfileName ?? "—"}</dd>
              </div>
              {entry.keywordPhrase ? (
                <div>
                  <dt className="font-medium text-foreground">
                    {t("detail.fields.keywordPhrase")}
                  </dt>
                  <dd>{entry.keywordPhrase}</dd>
                </div>
              ) : null}
              {entry.metaDescription ? (
                <div>
                  <dt className="font-medium text-foreground">
                    {t("detail.fields.metaDescription")}
                  </dt>
                  <dd>{entry.metaDescription}</dd>
                </div>
              ) : null}
              {jobId ? (
                <div>
                  <dt className="font-medium text-foreground">{t("detail.fields.jobId")}</dt>
                  <dd className="font-mono">{jobId}</dd>
                </div>
              ) : null}
              {entry.additionalInfo ? (
                <div className="sm:col-span-3">
                  <dt className="font-medium text-foreground">
                    {t("detail.fields.additionalInfo")}
                  </dt>
                  <dd>{entry.additionalInfo}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </div>
    </>
  )
}
