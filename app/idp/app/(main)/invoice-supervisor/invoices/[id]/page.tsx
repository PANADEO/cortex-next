"use client"

import { InvoiceSupervisorFormField } from "@/components/invoice-supervisor/invoice-form-field"
import {
  useInvoiceSupervisorClearDispute,
  useInvoiceSupervisorInvoice,
  useInvoiceSupervisorMarkDisputed,
  useInvoiceSupervisorPayments,
  useInvoiceSupervisorRegisterPayment,
} from "@/lib/invoice-supervisor/hooks"
import {
  formatInvoiceSupervisorCurrency,
  formatInvoiceSupervisorDate,
  INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS,
  INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS,
} from "@/lib/invoice-supervisor/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataCard,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Kwota musi być większa od 0"),
  paymentDate: z.string().min(1, "Data wpłaty jest wymagana"),
  note: z.string().optional(),
})
type PaymentFormInput = z.input<typeof paymentSchema>
type PaymentFormValues = z.output<typeof paymentSchema>

const disputeSchema = z.object({
  note: z.string().min(1, "Powód sporu jest wymagany"),
})
type DisputeFormInput = z.input<typeof disputeSchema>
type DisputeFormValues = z.output<typeof disputeSchema>

function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export default function InvoiceSupervisorInvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const invoiceId = Number(params?.id)

  const invoiceQuery = useInvoiceSupervisorInvoice(invoiceId)
  const paymentsQuery = useInvoiceSupervisorPayments(invoiceId)
  const registerPayment = useInvoiceSupervisorRegisterPayment(invoiceId)
  const markDisputed = useInvoiceSupervisorMarkDisputed(invoiceId)
  const clearDispute = useInvoiceSupervisorClearDispute(invoiceId)

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)

  const paymentForm = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: todayIsoDate() },
  })
  const disputeForm = useForm<DisputeFormInput, unknown, DisputeFormValues>({
    resolver: zodResolver(disputeSchema),
  })

  function onSubmitPayment(values: PaymentFormValues) {
    // Build the payload explicitly — zod's `.optional()` types `note` as
    // `string | undefined`, which exactOptionalPropertyTypes treats as
    // incompatible with the mutation's `note?: string`.
    const { note, ...rest } = values
    registerPayment.mutate(
      { ...rest, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          setPaymentOpen(false)
          paymentForm.reset({ paymentDate: todayIsoDate() })
        },
      },
    )
  }

  function onSubmitDispute(values: DisputeFormValues) {
    markDisputed.mutate(values.note, {
      onSuccess: () => {
        setDisputeOpen(false)
        disputeForm.reset()
      },
    })
  }

  if (!Number.isFinite(invoiceId)) {
    return (
      <ErrorState
        title="Nieprawidłowy identyfikator faktury"
        message="Nie można odnaleźć podanej faktury."
      />
    )
  }

  if (invoiceQuery.isPending) {
    return <LoadingState label="Wczytywanie faktury…" />
  }

  if (invoiceQuery.error || !invoiceQuery.data) {
    return (
      <ErrorState
        title="Nie znaleziono faktury"
        message="Nie udało się wczytać wybranej faktury."
        onRetry={() => invoiceQuery.refetch()}
      />
    )
  }

  const invoice = invoiceQuery.data
  const payments = paymentsQuery.data ?? []
  const remaining = invoice.amount - invoice.paid_amount

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={invoice.invoice_number}
        description="Szczegóły faktury, historia wpłat i status sporu."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/invoice-supervisor/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wróć do listy
            </Link>
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{invoice.client_name}</h2>
            <Badge
              variant="secondary"
              className={cn("border-0", INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS[invoice.status])}
            >
              {INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {invoice.status === "disputed" ? (
              <Button variant="outline" size="sm" onClick={() => clearDispute.mutate()}>
                Wyczyść spór
              </Button>
            ) : invoice.status === "overdue" ? (
              <Dialog
                open={disputeOpen}
                onOpenChange={(nextOpen) => {
                  setDisputeOpen(nextOpen)
                  if (!nextOpen) disputeForm.reset()
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ShieldAlert className="h-4 w-4" />
                    Oznacz jako sporną
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Oznacz fakturę jako sporną</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={disputeForm.handleSubmit(onSubmitDispute)} className="space-y-3">
                    <InvoiceSupervisorFormField
                      label="Powód sporu"
                      error={disputeForm.formState.errors.note?.message}
                    >
                      <Textarea rows={3} {...disputeForm.register("note")} />
                    </InvoiceSupervisorFormField>
                    <DialogFooter>
                      <Button type="submit" disabled={markDisputed.isPending}>
                        Potwierdź
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
            {invoice.status !== "paid" ? (
              <Dialog
                open={paymentOpen}
                onOpenChange={(nextOpen) => {
                  setPaymentOpen(nextOpen)
                  if (!nextOpen) paymentForm.reset({ paymentDate: todayIsoDate() })
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm">Zarejestruj wpłatę</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Zarejestruj wpłatę</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <InvoiceSupervisorFormField
                        label="Kwota"
                        error={paymentForm.formState.errors.amount?.message}
                      >
                        <Input type="number" step="0.01" {...paymentForm.register("amount")} />
                      </InvoiceSupervisorFormField>
                      <InvoiceSupervisorFormField
                        label="Data wpłaty"
                        error={paymentForm.formState.errors.paymentDate?.message}
                      >
                        <Input type="date" {...paymentForm.register("paymentDate")} />
                      </InvoiceSupervisorFormField>
                    </div>
                    <InvoiceSupervisorFormField label="Notatka (opcjonalnie)">
                      <Input {...paymentForm.register("note")} />
                    </InvoiceSupervisorFormField>
                    <DialogFooter>
                      <Button type="submit" disabled={registerPayment.isPending}>
                        Zapisz wpłatę
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>

        {invoice.dispute_note ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300">
            <strong>Notatka sporu:</strong> {invoice.dispute_note}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DataCard
            label="Kwota"
            value={formatInvoiceSupervisorCurrency(invoice.amount, invoice.currency)}
          />
          <DataCard
            label="Zapłacono"
            value={formatInvoiceSupervisorCurrency(invoice.paid_amount, invoice.currency)}
          />
          <DataCard
            label="Pozostało"
            value={formatInvoiceSupervisorCurrency(remaining, invoice.currency)}
            tone={remaining > 0 ? "warning" : "default"}
          />
          <DataCard label="Termin płatności" value={formatInvoiceSupervisorDate(invoice.due_date)} />
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Szczegóły</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <DetailRow label="Data wystawienia" value={formatInvoiceSupervisorDate(invoice.issue_date)} />
              <DetailRow label="Sprzedawca" value={invoice.seller_name} />
              {invoice.bank_account ? (
                <DetailRow label="Numer konta" value={invoice.bank_account} />
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Historia wpłat</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsQuery.isError ? (
                <ErrorState
                  title="Nie udało się wczytać historii wpłat"
                  message="Sprawdź połączenie z backendem i spróbuj ponownie."
                  onRetry={() => paymentsQuery.refetch()}
                  className="border-none bg-transparent"
                />
              ) : payments.length > 0 ? (
                <ul className="divide-y divide-border">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div className="font-medium">
                          {formatInvoiceSupervisorCurrency(payment.amount, invoice.currency)}
                        </div>
                        {payment.note ? (
                          <div className="text-xs text-muted-foreground">{payment.note}</div>
                        ) : null}
                      </div>
                      <span className="text-muted-foreground">
                        {formatInvoiceSupervisorDate(payment.payment_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Brak zarejestrowanych wpłat."
                  className="border-none bg-transparent py-6"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
