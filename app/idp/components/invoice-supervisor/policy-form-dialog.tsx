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
import { useTranslation } from "react-i18next"
import { z } from "zod"

// Komunikat walidacji jest KLUCZEM i18n, nie gotowym tekstem — schemat żyje na
// poziomie modułu, więc `t` jeszcze nie istnieje.
const schema = z.object({
  name: z.string().min(3, "validation.policyNameMin"),
  restrictiveness: z.enum(["mała", "średnia", "duża", "surowa"]),
  tone_id: z.coerce.number().optional(),
  enable_email: z.boolean(),
  enable_sms: z.boolean(),
})

// Wartości poziomów zostają po polsku — to DANE wysyłane do backendu, nie napis.
// Napis widoczny dla użytkownika bierze się z klucza obok. Kolejność kluczy jest
// kolejnością opcji na liście.
const RESTRICTIVENESS_KEYS: Record<FormInput["restrictiveness"], string> = {
  mała: "restrictiveness.low",
  średnia: "restrictiveness.medium",
  duża: "restrictiveness.high",
  surowa: "restrictiveness.strict",
}

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function InvoiceSupervisorPolicyFormDialog() {
  const { t } = useTranslation(["invoice-supervisor", "common"])
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
          {t("policyForm.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("policyForm.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>{t("policyForm.nameLabel")}</Label>
            <Input {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">
                {errors.name.message ? t(errors.name.message) : null}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>{t("policyForm.restrictivenessLabel")}</Label>
            <Select
              value={watch("restrictiveness")}
              onValueChange={(v) => setValue("restrictiveness", v as FormInput["restrictiveness"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESTRICTIVENESS_KEYS).map(([value, labelKey]) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{t("policyForm.toneLabel")}</Label>
            <Select
              value={String(watch("tone_id") ?? "")}
              onValueChange={(v) => setValue("tone_id", Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("policyForm.tonePlaceholder")} />
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
            <Label htmlFor="enable_email">{t("policyForm.emailChannel")}</Label>
            <Switch
              id="enable_email"
              checked={watch("enable_email")}
              onCheckedChange={(v) => setValue("enable_email", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="enable_sms">{t("policyForm.smsChannel")}</Label>
            <Switch
              id="enable_sms"
              checked={watch("enable_sms")}
              onCheckedChange={(v) => setValue("enable_sms", v)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createPolicy.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
