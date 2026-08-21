"use client"

import {
  formatInvoiceSupervisorCurrency,
  formatInvoiceSupervisorDate,
  INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS,
  INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS,
  type InvoiceSupervisorProposal,
} from "@/lib/invoice-supervisor/types"
import { Checkbox } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Mail, MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"

interface InvoiceSupervisorProposalListItemProps {
  proposal: InvoiceSupervisorProposal
  selected: boolean
  active: boolean
  onSelectChange: (checked: boolean) => void
  onClick: () => void
}

export function InvoiceSupervisorProposalListItem({
  proposal,
  selected,
  active,
  onSelectChange,
  onClick,
}: InvoiceSupervisorProposalListItemProps) {
  const { t } = useTranslation("invoice-supervisor")
  const ChannelIcon = proposal.channel === "email" ? Mail : MessageSquare
  const isPaymentDemand = proposal.escalation_stage === "payment_demand"

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer gap-3 border-b border-border px-4 py-3 transition-colors",
        active ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          disabled={isPaymentDemand}
          aria-label={isPaymentDemand ? t("proposal.demandCheckboxAria") : t("proposal.selectAria")}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{proposal.client_name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatInvoiceSupervisorDate(proposal.due_date)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ChannelIcon className="size-3" />
          <span className="truncate">{proposal.invoice_number}</span>
          <span>·</span>
          <span className="font-medium text-foreground">
            {formatInvoiceSupervisorCurrency(proposal.amount, proposal.currency)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {proposal.proposal_subject ?? proposal.proposal_content?.slice(0, 80)}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS[proposal.escalation_stage],
          )}
        >
          {INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS[proposal.escalation_stage]}
        </span>
      </div>
    </div>
  )
}
