"use client"

import { IntrastatMatchBadge, getIntrastatMatchLabel } from "@/components/intrastat/status"
import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"
import { Popover, PopoverContent, PopoverTrigger, Separator } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

interface MatchField {
  label: string
  value: string | null
  note?: string
}

export function IntrastatMatchDetailsPopover({ line }: { line: IntrastatDeclarationLine }) {
  const { t } = useTranslation("intrastat")
  const label = getIntrastatMatchLabel(t, line.cn_match_status)
  const fields = getMatchedFields(t, line)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t("matchDetails.showDetails", { label })}
        >
          <IntrastatMatchBadge status={line.cn_match_status} confidence={line.match_confidence} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-[380px] overflow-y-auto p-0"
      >
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t("matchDetails.heading", { label })}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              {t(`matchDetails.clientRule.${line.cn_match_status}`)}
            </p>
          </div>

          <Separator />

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("matchDetails.matchedFields")}
            </p>
            <dl className="space-y-2">
              {fields.map((field) => (
                <div key={field.label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="min-w-0">
                    <code
                      className={cn(
                        "block truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value || "—"}
                    </code>
                    {field.note ? (
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {field.note}
                      </p>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("matchDetails.technicalMethodTitle")}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {t(`matchDetails.technicalMethod.${line.cn_match_status}`)}
            </p>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-xs">
              <span className="text-muted-foreground">{t("matchDetails.matchFragment")}</span>
              <span className="min-w-0 truncate font-mono">{line.matched_fragment || "—"}</span>
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("matchDetails.confidence")}
            </p>
            <div className="grid grid-cols-[148px_minmax(0,1fr)] gap-2 text-xs">
              <span className="text-muted-foreground">{t("matchDetails.cnMatchConfidence")}</span>
              <span>{formatConfidence(line.match_confidence)}</span>
              <span className="text-muted-foreground">{t("matchDetails.overallConfidence")}</span>
              <span>{formatConfidence(line.confidence)}</span>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              {t("matchDetails.confidenceHint")}
            </p>
          </section>

          {line.alerts.length > 0 ? (
            <>
              <Separator />
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("matchDetails.reviewAlerts")}
                </p>
                <p className="text-xs font-medium">{formatReviewCount(t, line.alerts.length)}</p>
                <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                  {line.alerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function getMatchedFields(t: TFunction<"intrastat">, line: IntrastatDeclarationLine): MatchField[] {
  switch (line.cn_match_status) {
    case "exact":
      return [
        { label: t("matchDetails.fields.invoiceIndex"), value: line.item_index },
        { label: t("matchDetails.fields.resourceIndex"), value: line.matched_index },
        { label: t("matchDetails.fields.exportCn"), value: line.cn_code },
      ]
    case "prefix_unique":
      return [
        { label: t("matchDetails.fields.invoiceIndex"), value: line.item_index },
        {
          label: t("matchDetails.fields.matchedPrefix"),
          value: line.matched_fragment,
          note: t("matchDetails.notes.matchedPrefix"),
        },
        { label: t("matchDetails.fields.resourceIndex"), value: line.matched_index },
        { label: t("matchDetails.fields.exportCn"), value: line.cn_code },
      ]
    case "description_match":
      return [
        {
          label: t("matchDetails.fields.description"),
          value: line.description,
          note: t("matchDetails.notes.descriptionMatch"),
        },
        { label: t("matchDetails.fields.resourceIndex"), value: line.matched_index },
        { label: t("matchDetails.fields.exportCn"), value: line.cn_code },
      ]
    case "semantic_match":
      return [
        {
          label: t("matchDetails.fields.description"),
          value: line.description,
          note: t("matchDetails.notes.semanticMatch"),
        },
        { label: t("matchDetails.fields.resourceIndex"), value: line.matched_index },
        { label: t("matchDetails.fields.exportCn"), value: line.cn_code },
      ]
    case "invoice_cn":
      return [
        { label: t("matchDetails.fields.invoiceCn"), value: line.cn_code },
        { label: t("matchDetails.fields.exportCn"), value: line.cn_code },
      ]
    case "manual":
      return [
        { label: t("matchDetails.fields.reviewerCn"), value: line.cn_code },
        { label: t("matchDetails.fields.description"), value: line.description },
      ]
    case "ambiguous":
      return [
        { label: t("matchDetails.fields.invoiceIndex"), value: line.item_index },
        { label: t("matchDetails.fields.description"), value: line.description },
        {
          label: t("matchDetails.fields.candidateHint"),
          value: line.matched_fragment,
          note: t("matchDetails.notes.candidateHint"),
        },
      ]
    case "unmatched":
      return [
        { label: t("matchDetails.fields.invoiceIndex"), value: line.item_index },
        { label: t("matchDetails.fields.description"), value: line.description },
        { label: t("matchDetails.fields.exportCn"), value: line.cn_code },
      ]
  }
}

function formatConfidence(value: number | null): string {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}

export function formatReviewCount(t: TFunction<"intrastat">, count: number): string {
  return count === 1
    ? t("alerts.oneFieldRequiresReview")
    : t("alerts.manyFieldsRequireReview", { count })
}
