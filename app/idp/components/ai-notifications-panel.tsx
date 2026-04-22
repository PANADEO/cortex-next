"use client"

import { Badge, Card, CardContent } from "@cortex/ui"
import { cn } from "@cortex/utils"
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMemo } from "react"

type Severity = "info" | "warning" | "issue"
type Category = "consistency" | "missing" | "data-quality" | "suggestion"

interface AiNotification {
  id: string
  severity: Severity
  category: Category
  title: string
  detail: string
  sourceField?: string
}

const SEVERITY_META: Record<
  Severity,
  { label: string; icon: LucideIcon; tone: string; badge: string }
> = {
  info: {
    label: "Info",
    icon: Info,
    tone: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    tone: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
  },
  issue: {
    label: "Issue",
    icon: CircleAlert,
    tone: "text-red-700 dark:text-red-300",
    badge: "bg-red-500/15 text-red-800 dark:text-red-200 border-red-500/30",
  },
}

const CATEGORY_LABEL: Record<Category, string> = {
  consistency: "Cross-document consistency",
  missing: "Missing data",
  "data-quality": "Data quality",
  suggestion: "Suggestion",
}

const NOTIFICATION_CATALOG: readonly AiNotification[] = [
  {
    id: "totals-mismatch",
    severity: "issue",
    category: "consistency",
    title: "Invoice totals don’t reconcile",
    detail:
      "Sum of line items (12 349.75 EUR) differs from the invoice header total (12 450.75 EUR) by 101.00 EUR. Check if freight or packaging was included once at header level.",
    sourceField: "invoice.total_invoice_value",
  },
  {
    id: "hs-missing",
    severity: "issue",
    category: "missing",
    title: "Missing HS code on line 3",
    detail:
      "Line 3 (\"Plastic housings — CN 3926\") has no HS sub-heading. Classification rule fallback to 3926.90.97 was applied — please confirm.",
    sourceField: "lines[3].hs_code",
  },
  {
    id: "packing-qty",
    severity: "warning",
    category: "consistency",
    title: "Packing list quantity differs from invoice",
    detail:
      "Packing list declares 252 units of the first SKU, invoice reports 250 units. Likely a stray pair — verify with the shipper before export.",
    sourceField: "lines[1].quantity",
  },
  {
    id: "vies-unknown",
    severity: "warning",
    category: "data-quality",
    title: "Seller VAT not yet found in VIES",
    detail:
      "PL1234567890 has a valid checksum but did not return a match from the last VIES lookup (retry scheduled). This may simply be a temporary VIES outage.",
    sourceField: "seller.vat_id",
  },
  {
    id: "line2-weight",
    severity: "warning",
    category: "data-quality",
    title: "Unusual weight-per-unit on line 2",
    detail:
      "85 pcs of steel fittings totaling 142.3 kg yields 1.67 kg/pc — higher than the 0.4–0.9 kg/pc range seen in prior imports for CN 7307. Double-check the scale reading.",
    sourceField: "lines[2].net_weight_kg",
  },
  {
    id: "currency-implicit",
    severity: "info",
    category: "suggestion",
    title: "Currency inferred from line items",
    detail:
      "Page 1 of the invoice does not explicitly state the currency. EUR was inferred from the unit price column headers.",
    sourceField: "invoice.currency",
  },
  {
    id: "date-ambiguous",
    severity: "info",
    category: "data-quality",
    title: "Ambiguous date interpreted as EU format",
    detail:
      "Delivery note prints 04/05/2026 with no locale hint. Parsed as 4 May 2026 based on consignor country (DE). If the shipment is US-origin, reinterpret as 5 April 2026.",
    sourceField: "transport_info.delivery_date",
  },
  {
    id: "buyer-postcode",
    severity: "issue",
    category: "missing",
    title: "Buyer address is incomplete",
    detail:
      "Postal code is missing from the buyer address block. Customs declaration schema requires a 5-digit postcode for DE importers.",
    sourceField: "buyer.address.postal_code",
  },
  {
    id: "incoterm-default",
    severity: "info",
    category: "suggestion",
    title: "Incoterm defaulted to DAP",
    detail:
      "No explicit Incoterm clause was found. DAP was assumed because previous shipments from this seller used DAP. Please confirm before declaration.",
    sourceField: "delivery.incoterm",
  },
  {
    id: "cert-origin",
    severity: "warning",
    category: "consistency",
    title: "Certificate of origin mentions different shipper",
    detail:
      "Certificate of origin lists \"Acme Logistics Sp. z o.o.\" while the invoice seller is \"Acme Logistics S.A.\" — likely the same entity but the legal form differs.",
    sourceField: "certificate_of_origin.issuer",
  },
]

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

function selectNotifications(
  packageId: string,
  hasAnalysis: boolean,
): AiNotification[] {
  if (!hasAnalysis) return []
  const seed = hash(packageId)
  const count = 3 + (seed % 4) // 3–6 notifications
  const picks: AiNotification[] = []
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % NOTIFICATION_CATALOG.length
    const item = NOTIFICATION_CATALOG[idx]!
    if (!picks.some((p) => p.id === item.id)) picks.push(item)
  }
  return picks
}

function summarize(items: readonly AiNotification[]) {
  const issue = items.filter((n) => n.severity === "issue").length
  const warning = items.filter((n) => n.severity === "warning").length
  const info = items.filter((n) => n.severity === "info").length
  return { issue, warning, info }
}

interface AiNotificationsPanelProps {
  packageId: string
  hasAnalysis: boolean
}

export function AiNotificationsPanel({
  packageId,
  hasAnalysis,
}: AiNotificationsPanelProps) {
  const items = useMemo(
    () => selectNotifications(packageId, hasAnalysis),
    [packageId, hasAnalysis],
  )

  if (!hasAnalysis) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Analysis hasn’t run yet — AI notifications will appear here after extraction.
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          AI didn’t flag anything on this extraction.
        </CardContent>
      </Card>
    )
  }

  const counts = summarize(items)

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              AI flagged {items.length} observation{items.length === 1 ? "" : "s"}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {counts.issue > 0 ? (
              <SeverityChip severity="issue" count={counts.issue} />
            ) : null}
            {counts.warning > 0 ? (
              <SeverityChip severity="warning" count={counts.warning} />
            ) : null}
            {counts.info > 0 ? (
              <SeverityChip severity="info" count={counts.info} />
            ) : null}
          </div>
        </div>

        <ul className="space-y-2">
          {items.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function SeverityChip({ severity, count }: { severity: Severity; count: number }) {
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1", meta.badge)}>
      <Icon className="h-3 w-3" />
      {count} {meta.label.toLowerCase()}
      {count === 1 ? "" : "s"}
    </Badge>
  )
}

function NotificationRow({ notification }: { notification: AiNotification }) {
  const meta = SEVERITY_META[notification.severity]
  const Icon = meta.icon
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{notification.title}</p>
          <Badge variant="outline" className="text-[10px] font-normal">
            {CATEGORY_LABEL[notification.category]}
          </Badge>
          {notification.sourceField ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              {notification.sourceField}
            </span>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {notification.detail}
        </p>
      </div>
    </li>
  )
}
