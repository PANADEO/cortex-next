"use client"

import { useInvoiceSupervisorCreateInvoice } from "@/lib/invoice-supervisor/hooks"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { InvoiceSupervisorFormField } from "./invoice-form-field"

// Komunikaty walidacji są KLUCZAMI i18n, nie gotowym tekstem: schemat żyje na
// poziomie modułu, więc `t` jeszcze nie istnieje. Tłumaczy je miejsce, które je
// renderuje (patrz `fieldError` niżej).
const schema = z
  .object({
    invoice_number: z.string().min(1, "validation.invoiceNumberRequired"),
    client_name: z.string().min(1, "validation.invoiceClientNameRequired"),
    issue_date: z.string().min(1, "validation.issueDateRequired"),
    due_date: z.string().min(1, "validation.dueDateRequired"),
    amount: z.coerce.number().positive("validation.amountPositive"),
    currency: z.string().min(3).max(3),
    seller_name: z.string().min(1, "validation.sellerRequired"),
    bank_account: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.due_date < data.issue_date) {
      ctx.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "validation.dueDateAfterIssue",
      })
    }
  })

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function InvoiceSupervisorFormDialog() {
  const { t } = useTranslation(["invoice-supervisor", "common"])
  const [open, setOpen] = useState(false)
  const createInvoice = useInvoiceSupervisorCreateInvoice()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: "PLN" },
  })

  const fieldError = (message: string | undefined) => (message ? t(message) : undefined)

  function onSubmit(values: FormValues) {
    // Build the payload explicitly rather than passing `values` straight
    // through — zod's `.optional()` types bank_account as `string |
    // undefined`, which exactOptionalPropertyTypes treats as incompatible
    // with the API's `bank_account?: string`.
    const { bank_account, ...rest } = values
    createInvoice.mutate(
      { ...rest, ...(bank_account ? { bank_account } : {}) },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("invoiceForm.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoiceForm.title")}</DialogTitle>
          <DialogDescription>{t("invoiceForm.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InvoiceSupervisorFormField
            label={t("invoiceForm.invoiceNumberLabel")}
            error={fieldError(errors.invoice_number?.message)}
          >
            <Input {...register("invoice_number")} placeholder="FV/2026/07/001" />
          </InvoiceSupervisorFormField>
          <InvoiceSupervisorFormField
            label={t("invoiceForm.clientLabel")}
            error={fieldError(errors.client_name?.message)}
          >
            <Input {...register("client_name")} placeholder={t("invoiceForm.clientPlaceholder")} />
          </InvoiceSupervisorFormField>
          <div className="grid grid-cols-2 gap-3">
            <InvoiceSupervisorFormField
              label={t("invoiceForm.issueDateLabel")}
              error={fieldError(errors.issue_date?.message)}
            >
              <Input type="date" {...register("issue_date")} />
            </InvoiceSupervisorFormField>
            <InvoiceSupervisorFormField
              label={t("invoiceForm.dueDateLabel")}
              error={fieldError(errors.due_date?.message)}
            >
              <Input type="date" {...register("due_date")} />
            </InvoiceSupervisorFormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InvoiceSupervisorFormField
              label={t("invoiceForm.amountLabel")}
              error={fieldError(errors.amount?.message)}
            >
              <Input type="number" step="0.01" {...register("amount")} />
            </InvoiceSupervisorFormField>
            <InvoiceSupervisorFormField
              label={t("invoiceForm.currencyLabel")}
              error={fieldError(errors.currency?.message)}
            >
              <Input {...register("currency")} maxLength={3} />
            </InvoiceSupervisorFormField>
          </div>
          <InvoiceSupervisorFormField
            label={t("invoiceForm.sellerLabel")}
            error={fieldError(errors.seller_name?.message)}
          >
            <Input {...register("seller_name")} />
          </InvoiceSupervisorFormField>
          <InvoiceSupervisorFormField label={t("invoiceForm.bankAccountLabel")}>
            <Input {...register("bank_account")} />
          </InvoiceSupervisorFormField>
          <DialogFooter>
            <Button type="submit" disabled={createInvoice.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
