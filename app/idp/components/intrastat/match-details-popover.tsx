"use client"

import { IntrastatMatchBadge, getIntrastatMatchLabel } from "@/components/intrastat/status"
import type { IntrastatCnMatchStatus, IntrastatDeclarationLine } from "@/lib/intrastat/types"
import { Popover, PopoverContent, PopoverTrigger, Separator } from "@cortex/ui"
import { cn } from "@cortex/utils"

interface MatchAlgorithmDetails {
  clientRule: string
  technicalMethod: string
}

interface MatchField {
  label: string
  value: string | null
  note?: string
}

const MATCH_ALGORITHM_DETAILS: Record<IntrastatCnMatchStatus, MatchAlgorithmDetails> = {
  exact: {
    clientRule: "The client instruction says CN is tied to the product index in the database.",
    technicalMethod: "The system normalized the invoice index and found the same normalized index in the CN database. It accepts the match only when the matched database rows resolve to one CN code.",
  },
  prefix_unique: {
    clientRule: "The client instruction says that if there is no identical index, the closest corresponding database index should be used.",
    technicalMethod: "The system first checks the strongest shared prefix. If that fails, it checks text similarity between normalized indexes. The closest candidate is accepted only when it resolves to one CN code.",
  },
  description_match: {
    clientRule: "The client instruction says that if no index and no invoice CN can be used, CN should be matched from the invoice description to the closest database description.",
    technicalMethod: "The system compares the invoice line description with CN database descriptions using text similarity. It accepts the top description group only when it resolves to one CN code.",
  },
  semantic_match: {
    clientRule: "The client instruction says that if no index and no invoice CN can be used, CN should be matched from the invoice description to the closest database description.",
    technicalMethod: "The system uses description embeddings as a technical way to find the closest database description. A candidate is accepted only when it is above the configured threshold and is not too close to a competing CN code.",
  },
  invoice_cn: {
    clientRule: "The client instruction says that if no database index can be matched, the CN code shown on the invoice should be used.",
    technicalMethod: "The system normalizes the invoice CN and uses the first 8 digits after exact and closest-index database matching did not produce a CN code.",
  },
  manual: {
    clientRule: "The client instruction allows missing or uncertain CN data to be completed in the system and reused later.",
    technicalMethod: "A reviewer manually changed the CN fields. The automatic match status is replaced by a human-reviewed decision.",
  },
  ambiguous: {
    clientRule: "The client instruction requires using a closest index or closest description, but only when it can be assigned confidently.",
    technicalMethod: "Several candidates matched with different CN codes, so the system did not choose one automatically. The line remains for review.",
  },
  unmatched: {
    clientRule: "The client instruction says that if no similar index, invoice CN, or similar description is available, the CN field should remain empty.",
    technicalMethod: "Exact index, closest index, invoice CN, closest description, and semantic description checks did not produce an accepted CN code.",
  },
}

export function IntrastatMatchDetailsPopover({ line }: { line: IntrastatDeclarationLine }) {
  const details = MATCH_ALGORITHM_DETAILS[line.cn_match_status]
  const fields = getMatchedFields(line)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Show ${getIntrastatMatchLabel(line.cn_match_status)} match details`}
        >
          <IntrastatMatchBadge status={line.cn_match_status} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] p-0">
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {getIntrastatMatchLabel(line.cn_match_status)} match
            </p>
            <p className="text-xs leading-5 text-muted-foreground">{details.clientRule}</p>
          </div>

          <Separator />

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Matched fields
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
              Technical method
            </p>
            <p className="text-xs leading-5 text-muted-foreground">{details.technicalMethod}</p>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-xs">
              <span className="text-muted-foreground">Line confidence</span>
              <span>{formatConfidence(line.confidence)}</span>
              <span className="text-muted-foreground">Match fragment</span>
              <span className="min-w-0 truncate font-mono">{line.matched_fragment || "—"}</span>
            </div>
          </section>

          {line.alerts.length > 0 ? (
            <>
              <Separator />
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Review alerts
                </p>
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

function getMatchedFields(line: IntrastatDeclarationLine): MatchField[] {
  switch (line.cn_match_status) {
    case "exact":
      return [
        { label: "Invoice index", value: line.item_index },
        { label: "Resource index", value: line.matched_index },
        { label: "Export CN", value: line.cn_code },
      ]
    case "prefix_unique":
      return [
        { label: "Invoice index", value: line.item_index },
        {
          label: "Matched prefix",
          value: line.matched_fragment,
          note: "Common normalized prefix used to select the resource row.",
        },
        { label: "Resource index", value: line.matched_index },
        { label: "Export CN", value: line.cn_code },
      ]
    case "description_match":
      return [
        {
          label: "Description",
          value: line.description,
          note: "Compared against CN resource descriptions.",
        },
        { label: "Resource index", value: line.matched_index },
        { label: "Export CN", value: line.cn_code },
      ]
    case "semantic_match":
      return [
        {
          label: "Description",
          value: line.description,
          note: "Embedded and compared against CN resource embedding text.",
        },
        { label: "Resource index", value: line.matched_index },
        { label: "Export CN", value: line.cn_code },
      ]
    case "invoice_cn":
      return [
        { label: "Invoice CN", value: line.cn_code },
        { label: "Export CN", value: line.cn_code },
      ]
    case "manual":
      return [
        { label: "Reviewer CN", value: line.cn_code },
        { label: "Description", value: line.description },
      ]
    case "ambiguous":
      return [
        { label: "Invoice index", value: line.item_index },
        { label: "Description", value: line.description },
        {
          label: "Candidate hint",
          value: line.matched_fragment,
          note: "The system kept this hint but did not choose a CN code.",
        },
      ]
    case "unmatched":
      return [
        { label: "Invoice index", value: line.item_index },
        { label: "Description", value: line.description },
        { label: "Export CN", value: line.cn_code },
      ]
  }
}

function formatConfidence(value: number | null): string {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}
