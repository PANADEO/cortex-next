"use client"

import { InvoiceSupervisorTemplateEditorDialog } from "@/components/invoice-supervisor/template-editor-dialog"
import {
  useInvoiceSupervisorTemplateCoverage,
  useInvoiceSupervisorTemplates,
  useInvoiceSupervisorTones,
} from "@/lib/invoice-supervisor/hooks"
import {
  INVOICE_SUPERVISOR_CHANNEL_LABELS,
  INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS,
} from "@/lib/invoice-supervisor/types"
import type { InvoiceSupervisorChannel, InvoiceSupervisorEscalationStage } from "@/lib/invoice-supervisor/types"
import { Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Check, FileText, Pencil, Plus } from "lucide-react"
import { useState } from "react"

const CHANNELS: InvoiceSupervisorChannel[] = ["email", "sms"]
const STAGES: InvoiceSupervisorEscalationStage[] = [
  "proactive",
  "first_reminder",
  "follow_up_reminder",
  "payment_demand",
]

interface DialogTarget {
  toneId: number
  toneName: string
  toneDescription: string
  channel: InvoiceSupervisorChannel
  stage: InvoiceSupervisorEscalationStage
}

export default function InvoiceSupervisorTemplatesPage() {
  const coverageQuery = useInvoiceSupervisorTemplateCoverage()
  const templatesQuery = useInvoiceSupervisorTemplates()
  const { data: tones } = useInvoiceSupervisorTones()
  const { data: coverage } = coverageQuery
  const { data: templates } = templatesQuery
  const isLoading = coverageQuery.isLoading || templatesQuery.isLoading
  const isError = coverageQuery.isError || templatesQuery.isError
  const refetch = () => {
    coverageQuery.refetch()
    templatesQuery.refetch()
  }
  const [dialogTarget, setDialogTarget] = useState<DialogTarget | null>(null)

  const existingTemplate =
    dialogTarget && templates
      ? (templates.find(
          (t) =>
            t.tone_id === dialogTarget.toneId &&
            t.channel === dialogTarget.channel &&
            t.escalation_stage === dialogTarget.stage,
        ) ?? null)
      : null

  const toneEntries = coverage ? Object.entries(coverage) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Szablony"
        description="Macierz pokrycia: dla każdej kombinacji Ton × Kanał × Etap eskalacji musi istnieć zapisany szablon, inaczej generowanie propozycji jest zablokowane (nigdy nie ma fallbacku na żywe wywołanie AI)."
      />

      <div className="px-8 py-6">
        {isLoading ? (
          <LoadingState label="Ładowanie macierzy pokrycia..." />
        ) : isError ? (
          <ErrorState
            title="Nie udało się wczytać szablonów"
            message="Sprawdź połączenie z backendem i spróbuj ponownie."
            onRetry={() => refetch()}
          />
        ) : toneEntries.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Brak tonów"
            description="Dodaj ton komunikacji w polityce, aby zobaczyć macierz szablonów."
          />
        ) : (
          <div className="space-y-4">
            {toneEntries.map(([toneId, tone]) => (
              <Card key={toneId}>
                <CardHeader>
                  <CardTitle className="text-base">{tone.tone_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                            Etap eskalacji
                          </th>
                          {CHANNELS.map((channel) => (
                            <th
                              key={channel}
                              className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground"
                            >
                              {INVOICE_SUPERVISOR_CHANNEL_LABELS[channel]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {STAGES.map((stage) => (
                          <tr key={stage} className="border-b border-border last:border-b-0">
                            <td className="px-4 py-3 font-medium">
                              {INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS[stage]}
                            </td>
                            {CHANNELS.map((channel) => {
                              const entry = tone.channels[channel]?.[stage]
                              const exists = entry?.exists ?? false
                              return (
                                <td key={channel} className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDialogTarget({
                                        toneId: Number(toneId),
                                        toneName: tone.tone_name,
                                        toneDescription: tones?.find((t) => t.id === Number(toneId))?.description ?? "",
                                        channel,
                                        stage,
                                      })
                                    }
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                                      exists
                                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                                        : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20",
                                    )}
                                  >
                                    {exists ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                                    {exists ? "Gotowe" : "Utwórz"}
                                    {exists && <Pencil className="size-3 opacity-60" />}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {dialogTarget && (
        <InvoiceSupervisorTemplateEditorDialog
          open
          onOpenChange={(open) => !open && setDialogTarget(null)}
          existingTemplate={existingTemplate}
          {...dialogTarget}
        />
      )}
    </div>
  )
}
