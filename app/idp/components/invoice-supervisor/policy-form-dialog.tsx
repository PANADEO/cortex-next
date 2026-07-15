"use client"

import {
  useInvoiceSupervisorCreatePolicy,
  useInvoiceSupervisorTones,
} from "@/lib/invoice-supervisor/hooks"
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
  Switch,
} from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(3, "Nazwa musi mieć min. 3 znaki"),
  restrictiveness: z.enum(["mała", "średnia", "duża", "surowa"]),
  tone_id: z.coerce.number().optional(),
  enable_email: z.boolean(),
  enable_sms: z.boolean(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function InvoiceSupervisorPolicyFormDialog() {
  const [open, setOpen] = useState(false)
  const { data: tones } = useInvoiceSupervisorTones()
  const createPolicy = useInvoiceSupervisorCreatePolicy()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { restrictiveness: "średnia", enable_email: true, enable_sms: false },
  })

  function onSubmit(values: FormValues) {
    createPolicy.mutate(
      { ...values, tone_id: values.tone_id ?? null },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Nowa polityka
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowa polityka</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Restrykcyjność (jak często/mocno przypominać)</Label>
            <Select
              value={watch("restrictiveness")}
              onValueChange={(v) => setValue("restrictiveness", v as FormInput["restrictiveness"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mała">Mała</SelectItem>
                <SelectItem value="średnia">Średnia</SelectItem>
                <SelectItem value="duża">Duża</SelectItem>
                <SelectItem value="surowa">Surowa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Ton (jak brzmi wiadomość) — niezależny od restrykcyjności</Label>
            <Select
              value={String(watch("tone_id") ?? "")}
              onValueChange={(v) => setValue("tone_id", Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz ton" />
              </SelectTrigger>
              <SelectContent>
                {tones?.map((tone) => (
                  <SelectItem key={tone.id} value={String(tone.id)}>
                    {tone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="enable_email">Kanał e-mail</Label>
            <Switch
              id="enable_email"
              checked={watch("enable_email")}
              onCheckedChange={(v) => setValue("enable_email", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="enable_sms">Kanał SMS</Label>
            <Switch
              id="enable_sms"
              checked={watch("enable_sms")}
              onCheckedChange={(v) => setValue("enable_sms", v)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createPolicy.isPending}>
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
