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
  INVOICE_SUPERVISOR_INVOICE_STATUS_LABEL_KEYS,
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
import { useTranslation } from "react-i18next"
import { z } from "zod"

// Komunikaty walidacji są KLUCZAMI i18n, nie gotowym tekstem: schematy żyją na
// poziomie modułu, więc `t` jeszcze nie istnieje. Tłumaczy je miejsce, które je
// renderuje (patrz `fieldError` niżej).
const paymentSchema = z.object({
  amount: z.coerce.number().positive("validation.amountPositive"),
  paymentDate: z.string().min(1, "validation.paymentDateRequired"),
  note: z.string().optional(),
})
type PaymentFormInput = z.input<typeof paymentSchema>
type PaymentFormValues = z.output<typeof paymentSchema>

const disputeSchema = z.object({
  note: z.string().min(1, "validation.disputeReasonRequired"),
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
  const { t } = useTranslation("invoice-supervisor")
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

  const fieldError = (message: string | undefined) => (message ? t(message) : undefined)

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
        title={t("invoiceDetail.invalidIdTitle")}
        message={t("invoiceDetail.invalidIdMessage")}
      />
    )
  }

  if (invoiceQuery.isPending) {
    return <LoadingState label={t("invoiceDetail.loading")} />
  }

  if (invoiceQuery.error || !invoiceQuery.data) {
    return (
      <ErrorState
        title={t("invoiceDetail.notFoundTitle")}
        message={t("invoiceDetail.notFoundMessage")}
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
        description={t("invoiceDetail.description")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/invoice-supervisor/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("actions.backToList")}
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
              {t(INVOICE_SUPERVISOR_INVOICE_STATUS_LABEL_KEYS[invoice.status] ?? invoice.status)}
            </Badge>
          </div>
          <div className="flex gap-2">
            {invoice.status === "disputed" ? (
              <Button variant="outline" size="sm" onClick={() => clearDispute.mutate()}>
                {t("invoiceDetail.clearDispute")}
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
                    {t("invoiceDetail.markDisputed")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("invoiceDetail.markDisputedTitle")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={disputeForm.handleSubmit(onSubmitDispute)} className="space-y-3">
                    <InvoiceSupervisorFormField
                      label={t("invoiceDetail.disputeReasonLabel")}
                      error={fieldError(disputeForm.formState.errors.note?.message)}
                    >
                      <Textarea rows={3} {...disputeForm.register("note")} />
                    </InvoiceSupervisorFormField>
                    <DialogFooter>
                      <Button type="submit" disabled={markDisputed.isPending}>
                        {t("invoiceDetail.confirmDispute")}
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
                  <Button size="sm">{t("invoiceDetail.registerPayment")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("invoiceDetail.registerPaymentTitle")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <InvoiceSupervisorFormField
                        label={t("invoiceDetail.amountLabel")}
                        error={fieldError(paymentForm.formState.errors.amount?.message)}
                      >
                        <Input type="number" step="0.01" {...paymentForm.register("amount")} />
                      </InvoiceSupervisorFormField>
                      <InvoiceSupervisorFormField
                        label={t("invoiceDetail.paymentDateLabel")}
                        error={fieldError(paymentForm.formState.errors.paymentDate?.message)}
                      >
                        <Input type="date" {...paymentForm.register("paymentDate")} />
                      </InvoiceSupervisorFormField>
                    </div>
                    <InvoiceSupervisorFormField label={t("invoiceDetail.noteLabel")}>
                      <Input {...paymentForm.register("note")} />
                    </InvoiceSupervisorFormField>
                    <DialogFooter>
                      <Button type="submit" disabled={registerPayment.isPending}>
                        {t("invoiceDetail.savePayment")}
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
            <strong>{t("invoiceDetail.disputeNoteLabel")}</strong> {invoice.dispute_note}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DataCard
            label={t("invoiceDetail.cardAmount")}
            value={formatInvoiceSupervisorCurrency(invoice.amount, invoice.currency)}
          />
          <DataCard
            label={t("invoiceDetail.cardPaid")}
            value={formatInvoiceSupervisorCurrency(invoice.paid_amount, invoice.currency)}
          />
          <DataCard
            label={t("invoiceDetail.cardRemaining")}
            value={formatInvoiceSupervisorCurrency(remaining, invoice.currency)}
            tone={remaining > 0 ? "warning" : "default"}
          />
          <DataCard
            label={t("invoiceDetail.cardDueDate")}
            value={formatInvoiceSupervisorDate(invoice.due_date)}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("invoiceDetail.detailsCard")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <DetailRow
                label={t("invoiceDetail.issueDate")}
                value={formatInvoiceSupervisorDate(invoice.issue_date)}
              />
              <DetailRow label={t("invoiceDetail.seller")} value={invoice.seller_name} />
              {invoice.bank_account ? (
                <DetailRow label={t("invoiceDetail.bankAccount")} value={invoice.bank_account} />
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("invoiceDetail.paymentsCard")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsQuery.isError ? (
                <ErrorState
                  title={t("invoiceDetail.paymentsErrorTitle")}
                  message={t("errors.backendMessage")}
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
                  title={t("invoiceDetail.paymentsEmpty")}
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
