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

// Notification log status isn't in the shared domain types (kept generic
// there as `string`) — labels/colors are page-local, same convention as
// INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS in lib/invoice-supervisor/types.ts.
const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  sent: "Wysłano",
  delivered: "Dostarczono",
  bounced: "Odrzucono",
  failed: "Błąd",
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
  return (
    <Badge
      variant="outline"
      className={NOTIFICATION_STATUS_CLASSES[status] ?? NOTIFICATION_STATUS_FALLBACK_CLASS}
    >
      {NOTIFICATION_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

export default function InvoiceSupervisorNotificationsPage() {
  const { data: log, isLoading, isError, refetch } = useInvoiceSupervisorNotificationLog()
  const { data: failed } = useInvoiceSupervisorFailedTasks()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Historia wysyłek"
        description="Pełny log audytowy każdej wysłanej wiadomości (AI-005)."
      />

      <div className="space-y-4 px-8 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wysłane</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState variant="skeleton" rows={5} />
            ) : isError ? (
              <ErrorState
                title="Nie udało się wczytać historii wysyłek"
                message="Sprawdź połączenie z backendem i spróbuj ponownie."
                onRetry={() => refetch()}
              />
            ) : log && log.length > 0 ? (
              <NotificationLogTable entries={log} />
            ) : (
              <EmptyState icon={Mail} title="Brak zarejestrowanych wysyłek" />
            )}
          </CardContent>
        </Card>

        {failed && failed.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nieudane próby wysyłki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FailedTasksTable tasks={failed} />
              <p className="text-xs text-muted-foreground">
                Najczęstsza przyczyna: klient nie ma zapisanego adresu e-mail/telefonu. Uzupełnij
                dane kontaktowe w sekcji Klienci, a następnie zatwierdź propozycję ponownie.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function NotificationLogTable({ entries }: { entries: InvoiceSupervisorNotificationLogEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Data wysyłki
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Faktura
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Klient
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Kanał
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Adresat
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Dostawca
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              ID wiadomości
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
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Data błędu
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Faktura
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Kanał
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Błąd
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
              Liczba prób
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
