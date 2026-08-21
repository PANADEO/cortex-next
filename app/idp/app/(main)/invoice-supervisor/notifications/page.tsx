"use client"

import {
  useInvoiceSupervisorFailedTasks,
  useInvoiceSupervisorNotificationLog,
} from "@/lib/invoice-supervisor/hooks"
import type {
  InvoiceSupervisorFailedTask,
  InvoiceSupervisorNotificationLogEntry,
} from "@/lib/invoice-supervisor/types"
import {
  formatInvoiceSupervisorDateTime,
  INVOICE_SUPERVISOR_CHANNEL_LABELS,
} from "@/lib/invoice-supervisor/types"
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { Mail } from "lucide-react"
import { useTranslation } from "react-i18next"

// Notification log status isn't in the shared domain types (kept generic
// there as `string`) — labels/colors are page-local, same convention as
// INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS in lib/invoice-supervisor/types.ts.
const NOTIFICATION_STATUS_KEYS: Record<string, string> = {
  sent: "statuses.sent",
  delivered: "statuses.delivered",
  bounced: "statuses.bounced",
  failed: "statuses.failed",
}

const NOTIFICATION_STATUS_CLASSES: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  bounced: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
}
const NOTIFICATION_STATUS_FALLBACK_CLASS =
  "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"

function formatSentAt(value: string | null): string {
  return value ? formatInvoiceSupervisorDateTime(value) : "—"
}

function NotificationStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("invoice-supervisor")
  const labelKey = NOTIFICATION_STATUS_KEYS[status]

  return (
    <Badge
      variant="outline"
      className={NOTIFICATION_STATUS_CLASSES[status] ?? NOTIFICATION_STATUS_FALLBACK_CLASS}
    >
      {labelKey ? t(labelKey) : status}
    </Badge>
  )
}

export default function InvoiceSupervisorNotificationsPage() {
  const { t } = useTranslation("invoice-supervisor")
  const { data: log, isLoading, isError, refetch } = useInvoiceSupervisorNotificationLog()
  const { data: failed } = useInvoiceSupervisorFailedTasks()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t("notifications.title")} description={t("notifications.description")} />

      <div className="space-y-4 px-8 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("notifications.sentCard")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState variant="skeleton" rows={5} />
            ) : isError ? (
              <ErrorState
                title={t("notifications.loadErrorTitle")}
                message={t("errors.backendMessage")}
                onRetry={() => refetch()}
              />
            ) : log && log.length > 0 ? (
              <NotificationLogTable entries={log} />
            ) : (
              <EmptyState icon={Mail} title={t("notifications.emptyTitle")} />
            )}
          </CardContent>
        </Card>

        {failed && failed.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("notifications.failedCard")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FailedTasksTable tasks={failed} />
              <p className="text-xs text-muted-foreground">{t("notifications.failedHint")}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function NotificationLogTable({ entries }: { entries: InvoiceSupervisorNotificationLogEntry[] }) {
  const { t } = useTranslation("invoice-supervisor")

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colSentAt")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colInvoice")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colClient")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colChannel")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colRecipient")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colProvider")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colStatus")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colMessageId")}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 text-muted-foreground">{formatSentAt(entry.sent_at)}</td>
              <td className="px-4 py-3 font-medium">{entry.invoice_number}</td>
              <td className="px-4 py-3">{entry.client_name}</td>
              <td className="px-4 py-3">
                {INVOICE_SUPERVISOR_CHANNEL_LABELS[entry.channel] ?? entry.channel}
              </td>
              <td className="px-4 py-3">{entry.recipient}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{entry.provider}</Badge>
              </td>
              <td className="px-4 py-3">
                <NotificationStatusBadge status={entry.status} />
                {entry.error_message ? (
                  <p
                    className="mt-1 max-w-48 truncate text-xs text-destructive"
                    title={entry.error_message}
                  >
                    {entry.error_message}
                  </p>
                ) : null}
              </td>
              <td className="max-w-48 truncate px-4 py-3 text-xs text-muted-foreground">
                {entry.external_id ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FailedTasksTable({ tasks }: { tasks: InvoiceSupervisorFailedTask[] }) {
  const { t } = useTranslation("invoice-supervisor")

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colErrorAt")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colInvoice")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colChannel")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colError")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              {t("notifications.colRetries")}
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 text-muted-foreground">
                {formatSentAt(task.last_error_at)}
              </td>
              <td className="px-4 py-3 font-medium">#{task.invoice_id}</td>
              <td className="px-4 py-3">
                {INVOICE_SUPERVISOR_CHANNEL_LABELS[task.task_type] ?? task.task_type}
              </td>
              <td className="px-4 py-3 text-destructive">{task.error_message}</td>
              <td className="px-4 py-3">{task.retry_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
