"use client"

import {
  useInvoiceSupervisorApproveProposal,
  useInvoiceSupervisorEditProposal,
  useInvoiceSupervisorRejectProposal,
} from "@/lib/invoice-supervisor/hooks"
import {
  formatInvoiceSupervisorCurrency,
  formatInvoiceSupervisorDate,
  formatInvoiceSupervisorDateTime,
  INVOICE_SUPERVISOR_CHANNEL_LABEL_KEYS,
  INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS,
  INVOICE_SUPERVISOR_ESCALATION_STAGE_LABEL_KEYS,
  type InvoiceSupervisorProposal,
} from "@/lib/invoice-supervisor/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
  Separator,
  Textarea,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import { CheckCircle2, Inbox, Pencil, Save, Sparkles, XCircle } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface InvoiceSupervisorProposalDetailPanelProps {
  proposal: InvoiceSupervisorProposal | null
}

export function InvoiceSupervisorProposalDetailPanel({
  proposal,
}: InvoiceSupervisorProposalDetailPanelProps) {
  const { t } = useTranslation("invoice-supervisor")

  if (!proposal) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Inbox className="size-10" />
        <p className="text-sm">{t("proposal.emptySelection")}</p>
      </div>
    )
  }

  // Keyed by proposal.id so the edit buffer (and edit mode) resets naturally
  // via remount when the selection changes — no effect needed to "re-sync" state.
  return <ProposalDetailBody key={proposal.id} proposal={proposal} />
}

function ProposalDetailBody({ proposal }: { proposal: InvoiceSupervisorProposal }) {
  const { t } = useTranslation(["invoice-supervisor", "common"])
  const [isEditing, setIsEditing] = useState(false)
  const [subject, setSubject] = useState(proposal.proposal_subject ?? "")
  const [content, setContent] = useState(proposal.proposal_content ?? "")

  const approve = useInvoiceSupervisorApproveProposal()
  const reject = useInvoiceSupervisorRejectProposal()
  const edit = useInvoiceSupervisorEditProposal()

  const isPaymentDemand = proposal.escalation_stage === "payment_demand"
  const canEditSubject = proposal.channel === "email"

  function handleSave() {
    edit.mutate(
      { id: proposal.id, subject: canEditSubject ? subject : null, content },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{proposal.client_name}</h2>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS[proposal.escalation_stage],
              )}
            >
              {t(INVOICE_SUPERVISOR_ESCALATION_STAGE_LABEL_KEYS[proposal.escalation_stage])}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {proposal.invoice_number} ·{" "}
            {formatInvoiceSupervisorCurrency(proposal.amount, proposal.currency)} ·{" "}
            {t("proposal.dueLabel")} {formatInvoiceSupervisorDate(proposal.due_date)} ·{" "}
            {t(INVOICE_SUPERVISOR_CHANNEL_LABEL_KEYS[proposal.channel])}
          </p>
        </div>
      </div>

      {proposal.ai_reasoning && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          <span>{proposal.ai_reasoning}</span>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {canEditSubject && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("proposal.subjectLabel")}
            </label>
            <Input
              value={subject}
              disabled={!isEditing}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("proposal.contentLabel")}
          </label>
          <Textarea
            value={content}
            disabled={!isEditing}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="resize-none font-mono text-sm"
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={edit.isPending}>
                <Save className="size-4" />
                {t("common:actions.save")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                {t("common:actions.cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={proposal.status !== "pending" && proposal.status !== "edited"}
            >
              <Pencil className="size-4" />
              {t("common:actions.edit")}
            </Button>
          )}
        </div>

        {proposal.status === "pending" || proposal.status === "edited" ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => reject.mutate(proposal.id)}
              disabled={reject.isPending}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="size-4" />
              {t("proposal.reject")}
            </Button>
            {isPaymentDemand ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    <CheckCircle2 className="size-4" />
                    {t("proposal.approveDemand")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("proposal.approveDemandTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("proposal.approveDemandDescription", {
                        client: proposal.client_name,
                        invoice: proposal.invoice_number,
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => approve.mutate(proposal.id)}>
                      {t("proposal.approve")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                size="sm"
                onClick={() => approve.mutate(proposal.id)}
                disabled={approve.isPending}
              >
                <CheckCircle2 className="size-4" />
                {t("proposal.approve")}
              </Button>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {proposal.status === "sent" && t("proposal.statusSent")}
            {proposal.status === "approved" && t("proposal.statusApproved")}
            {proposal.status === "rejected" && t("proposal.statusRejected")}
            {proposal.reviewed_at && ` · ${formatInvoiceSupervisorDateTime(proposal.reviewed_at)}`}
          </span>
        )}
      </div>
    </div>
  )
}
