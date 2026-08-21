"use client"

import { usePackageTransportOrders } from "@cortex/api"
import type { Invoice } from "@cortex/types"
import { Badge, Card, CardContent, LoadingState } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

type Severity = "info" | "warning"

interface AiNotification {
  id: string
  severity: Severity
  title: string
  /** SAM NUMER faktury, nie gotowa etykieta — napis powstaje przy renderze. */
  invoiceNumber?: string
}

// `countKey` to KLUCZ przestrzeni `idp`, nie napis — mapa żyje poza komponentem.
const SEVERITY_META: Record<
  Severity,
  { countKey: string; icon: LucideIcon; tone: string; badge: string }
> = {
  info: {
    countKey: "aiNotifications.noteCount",
    icon: Info,
    tone: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30",
  },
  warning: {
    countKey: "aiNotifications.warningCount",
    icon: AlertTriangle,
    tone: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
  },
}

export function buildNotifications(invoices: readonly Invoice[]): AiNotification[] {
  const multiInvoice = invoices.length > 1
  const items: AiNotification[] = []
  for (const inv of invoices) {
    const base = (id: string, severity: Severity, title: string): AiNotification =>
      multiInvoice
        ? { id, severity, title, invoiceNumber: inv.invoice_number ?? inv.id }
        : { id, severity, title }
    inv.warnings.forEach((text, i) => {
      items.push(base(`${inv.id}-w-${i}`, "warning", text))
    })
    inv.notes.forEach((text, i) => {
      items.push(base(`${inv.id}-n-${i}`, "info", text))
    })
  }
  return items
}

export function summarize(items: readonly AiNotification[]): { warning: number; info: number } {
  const warning = items.filter((n) => n.severity === "warning").length
  const info = items.filter((n) => n.severity === "info").length
  return { warning, info }
}

interface AiNotificationCounts {
  warning: number
  info: number
  isLoaded: boolean
}

export function useAiNotificationCounts(packageId: string): AiNotificationCounts {
  const { data, isLoading } = usePackageTransportOrders(packageId, { polling: false })

  if (isLoading) return { warning: 0, info: 0, isLoaded: false }

  const orders = data?.verified_transport_orders ?? data?.transport_orders ?? null
  if (orders === null) return { warning: 0, info: 0, isLoaded: true }

  const items = buildNotifications(orders.flatMap((o) => o.invoices))
  return { ...summarize(items), isLoaded: true }
}

interface AiNotificationsPanelProps {
  packageId: string
}

export function AiNotificationsPanel({ packageId }: AiNotificationsPanelProps) {
  const { t } = useTranslation("idp")
  const { data, isLoading } = usePackageTransportOrders(packageId, { polling: false })

  if (isLoading) return <LoadingState variant="skeleton" rows={3} />

  const orders = data?.verified_transport_orders ?? data?.transport_orders ?? null

  if (orders === null) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          {t("aiNotifications.notRun")}
        </CardContent>
      </Card>
    )
  }

  const invoices = orders.flatMap((o) => o.invoices)
  const items = buildNotifications(invoices)

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {t("aiNotifications.nothingFlagged")}
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
              {t("aiNotifications.flagged", { count: items.length })}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {counts.warning > 0 ? <SeverityChip severity="warning" count={counts.warning} /> : null}
            {counts.info > 0 ? <SeverityChip severity="info" count={counts.info} /> : null}
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
  const { t } = useTranslation("idp")
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1", meta.badge)}>
      <Icon className="h-3 w-3" />
      {t(meta.countKey, { count })}
    </Badge>
  )
}

function NotificationRow({ notification }: { notification: AiNotification }) {
  const { t } = useTranslation("idp")
  const meta = SEVERITY_META[notification.severity]
  const Icon = meta.icon
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{notification.title}</p>
          {notification.invoiceNumber ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              {t("transportOrders.invoiceLabel", { number: notification.invoiceNumber })}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
