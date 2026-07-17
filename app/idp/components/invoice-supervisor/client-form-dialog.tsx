"use client"

import {
  useInvoiceSupervisorCreateClient,
  useInvoiceSupervisorUpdateClient,
} from "@/lib/invoice-supervisor/hooks"
import {
  INVOICE_SUPERVISOR_CLIENT_TYPE_LABELS,
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
import { z } from "zod"

const clientFormSchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  type: z.enum(["nowy", "stały", "vip"]),
  email: z.string().email("Nieprawidłowy adres e-mail").optional().or(z.literal("")),
  phone: z.string().optional(),
})

type ClientFormValues = z.infer<typeof clientFormSchema>

const CLIENT_TYPE_OPTIONS = Object.entries(INVOICE_SUPERVISOR_CLIENT_TYPE_LABELS) as Array<
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
            Edytuj
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nowy klient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edytuj klienta" : "Nowy klient"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="invoice-supervisor-client-name">Nazwa</Label>
            <Input id="invoice-supervisor-client-name" {...register("name")} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoice-supervisor-client-type">Typ</Label>
            <Select
              value={watch("type")}
              onValueChange={(value) => setValue("type", value as ClientFormValues["type"])}
            >
              <SelectTrigger id="invoice-supervisor-client-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="invoice-supervisor-client-email">E-mail</Label>
              <Input id="invoice-supervisor-client-email" {...register("email")} />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-supervisor-client-phone">Telefon</Label>
              <Input
                id="invoice-supervisor-client-phone"
                {...register("phone")}
                placeholder="+48123456789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
