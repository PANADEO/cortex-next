"use client"

import {
  useInvoiceSupervisorCreateClient,
  useInvoiceSupervisorUpdateClient,
} from "@/lib/invoice-supervisor/hooks"
import {
  INVOICE_SUPERVISOR_CLIENT_TYPE_LABEL_KEYS,
  type InvoiceSupervisorClient,
} from "@/lib/invoice-supervisor/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

// Komunikaty walidacji są KLUCZAMI i18n, nie gotowym tekstem: schemat żyje na
// poziomie modułu, więc `t` jeszcze nie istnieje. Tłumaczy je miejsce, które je
// renderuje (patrz `fieldError` niżej).
const clientFormSchema = z.object({
  name: z.string().min(1, "validation.clientNameRequired"),
  type: z.enum(["nowy", "stały", "vip"]),
  email: z.string().email("validation.clientEmailInvalid").optional().or(z.literal("")),
  phone: z.string().optional(),
})

type ClientFormValues = z.infer<typeof clientFormSchema>

// Druga para [wartość, KLUCZ tłumaczenia] — nie napis, z tego samego powodu co
// komunikaty walidacji wyżej: lista żyje na poziomie modułu, `t` woła render.
const CLIENT_TYPE_OPTIONS = Object.entries(INVOICE_SUPERVISOR_CLIENT_TYPE_LABEL_KEYS) as Array<
  [ClientFormValues["type"], string]
>

function defaultValuesFor(client: InvoiceSupervisorClient | undefined): ClientFormValues {
  return {
    name: client?.name ?? "",
    type: client?.type ?? "nowy",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
  }
}

interface InvoiceSupervisorClientFormDialogProps {
  /** Present => edit an existing client. Absent => create a new one ("Nowy klient" trigger). */
  client?: InvoiceSupervisorClient
}

export function InvoiceSupervisorClientFormDialog({
  client,
}: InvoiceSupervisorClientFormDialogProps) {
  const { t } = useTranslation(["invoice-supervisor", "common"])
  const isEdit = client != null
  const [open, setOpen] = useState(false)
  const createClient = useInvoiceSupervisorCreateClient()
  const updateClient = useInvoiceSupervisorUpdateClient(client?.id ?? Number.NaN)
  const mutation = isEdit ? updateClient : createClient

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaultValuesFor(client),
  })

  useEffect(() => {
    if (open) reset(defaultValuesFor(client))
  }, [open, client, reset])

  const fieldError = (message: string | undefined) => (message ? t(message) : undefined)

  function onSubmit(values: ClientFormValues) {
    mutation.mutate(
      {
        name: values.name,
        type: values.type,
        email: values.email ? values.email : null,
        phone: values.phone ? values.phone : null,
      },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            {t("common:actions.edit")}
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("clientForm.newClient")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("clientForm.editTitle") : t("clientForm.newClient")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="invoice-supervisor-client-name">{t("clientForm.nameLabel")}</Label>
            <Input id="invoice-supervisor-client-name" {...register("name")} />
            {errors.name ? (
              <p className="text-xs text-destructive">{fieldError(errors.name.message)}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoice-supervisor-client-type">{t("clientForm.typeLabel")}</Label>
            <Select
              value={watch("type")}
              onValueChange={(value) => setValue("type", value as ClientFormValues["type"])}
            >
              <SelectTrigger id="invoice-supervisor-client-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPE_OPTIONS.map(([value, labelKey]) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="invoice-supervisor-client-email">{t("clientForm.emailLabel")}</Label>
              <Input id="invoice-supervisor-client-email" {...register("email")} />
              {errors.email ? (
                <p className="text-xs text-destructive">{fieldError(errors.email.message)}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-supervisor-client-phone">{t("clientForm.phoneLabel")}</Label>
              <Input
                id="invoice-supervisor-client-phone"
                {...register("phone")}
                placeholder="+48123456789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
