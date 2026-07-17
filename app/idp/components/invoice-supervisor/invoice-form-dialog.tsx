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
import { z } from "zod"
import { InvoiceSupervisorFormField } from "./invoice-form-field"

const schema = z
  .object({
    invoice_number: z.string().min(1, "Numer faktury jest wymagany"),
    client_name: z.string().min(1, "Nazwa klienta jest wymagana"),
    issue_date: z.string().min(1, "Data wystawienia jest wymagana"),
    due_date: z.string().min(1, "Termin płatności jest wymagany"),
    amount: z.coerce.number().positive("Kwota musi być większa od 0"),
    currency: z.string().min(3).max(3),
    seller_name: z.string().min(1, "Sprzedawca jest wymagany"),
    bank_account: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.due_date < data.issue_date) {
      ctx.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "Termin musi być po dacie wystawienia",
      })
    }
  })

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function InvoiceSupervisorFormDialog() {
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
          Nowa faktura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowa faktura</DialogTitle>
          <DialogDescription>
            Wprowadź dane faktury. Klient zostanie utworzony automatycznie, jeśli nie istnieje.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InvoiceSupervisorFormField label="Numer faktury" error={errors.invoice_number?.message}>
            <Input {...register("invoice_number")} placeholder="FV/2026/07/001" />
          </InvoiceSupervisorFormField>
          <InvoiceSupervisorFormField label="Klient" error={errors.client_name?.message}>
            <Input {...register("client_name")} placeholder="ACME Sp. z o.o." />
          </InvoiceSupervisorFormField>
          <div className="grid grid-cols-2 gap-3">
            <InvoiceSupervisorFormField label="Data wystawienia" error={errors.issue_date?.message}>
              <Input type="date" {...register("issue_date")} />
            </InvoiceSupervisorFormField>
            <InvoiceSupervisorFormField label="Termin płatności" error={errors.due_date?.message}>
              <Input type="date" {...register("due_date")} />
            </InvoiceSupervisorFormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InvoiceSupervisorFormField label="Kwota" error={errors.amount?.message}>
              <Input type="number" step="0.01" {...register("amount")} />
            </InvoiceSupervisorFormField>
            <InvoiceSupervisorFormField label="Waluta" error={errors.currency?.message}>
              <Input {...register("currency")} maxLength={3} />
            </InvoiceSupervisorFormField>
          </div>
          <InvoiceSupervisorFormField label="Sprzedawca" error={errors.seller_name?.message}>
            <Input {...register("seller_name")} />
          </InvoiceSupervisorFormField>
          <InvoiceSupervisorFormField label="Numer konta (opcjonalnie)">
            <Input {...register("bank_account")} />
          </InvoiceSupervisorFormField>
          <DialogFooter>
            <Button type="submit" disabled={createInvoice.isPending}>
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
