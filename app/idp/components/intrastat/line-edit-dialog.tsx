"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatPatchLine } from "@/lib/intrastat/hooks"
import type { IntrastatDeclarationLine, IntrastatLinePatchRequest } from "@/lib/intrastat/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface Props {
  batchId: string
  line: IntrastatDeclarationLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  cn_code: string
  description: string
  net_weight: string
  origin_country: string
  delivery_terms: string
  vat_number: string
  quantity: string
  value: string
  currency: string
}

export function IntrastatLineEditDialog({ batchId, line, open, onOpenChange }: Props) {
  const patchLine = useIntrastatPatchLine(batchId)
  const [form, setForm] = useState<FormState>(() => emptyForm())

  useEffect(() => {
    if (!line) {
      setForm(emptyForm())
      return
    }
    setForm({
      cn_code: line.cn_code ?? "",
      description: line.description ?? "",
      net_weight: valueToString(line.net_weight),
      origin_country: line.origin_country ?? "",
      delivery_terms: line.delivery_terms ?? "",
      vat_number: line.vat_number ?? "",
      quantity: valueToString(line.quantity),
      value: valueToString(line.value),
      currency: line.currency ?? "",
    })
  }, [line])

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    if (!line) return
    const payload: IntrastatLinePatchRequest = {
      cn_code: nullableText(form.cn_code),
      description: nullableText(form.description),
      net_weight: nullableNumber(form.net_weight),
      origin_country: nullableText(form.origin_country),
      delivery_terms: nullableText(form.delivery_terms),
      vat_number: nullableText(form.vat_number),
      quantity: nullableNumber(form.quantity),
      value: nullableNumber(form.value),
      currency: nullableText(form.currency),
    }

    try {
      await patchLine.mutateAsync({ lineId: line.id, payload })
      toast.success("Intrastat line updated")
      onOpenChange(false)
    } catch (error) {
      toast.error(formatIntrastatError(error, "Line update failed"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit line {line?.invoice_number ?? ""}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="CN code"
            value={form.cn_code}
            onChange={(value) => update("cn_code", value)}
          />
          <Field
            label="Net weight"
            type="number"
            value={form.net_weight}
            onChange={(value) => update("net_weight", value)}
          />
          <Field
            label="Origin"
            value={form.origin_country}
            onChange={(value) => update("origin_country", value.toUpperCase())}
          />
          <Field
            label="Delivery terms"
            value={form.delivery_terms}
            onChange={(value) => update("delivery_terms", value.toUpperCase())}
          />
          <Field
            label="NIP/VAT"
            value={form.vat_number}
            onChange={(value) => update("vat_number", value)}
          />
          <Field
            label="Currency"
            value={form.currency}
            onChange={(value) => update("currency", value.toUpperCase())}
          />
          <Field
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(value) => update("quantity", value)}
          />
          <Field
            label="Value"
            type="number"
            value={form.value}
            onChange={(value) => update("value", value)}
          />
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="intrastat-line-description">Description</Label>
            <Input
              id="intrastat-line-description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={patchLine.isPending}>
            {patchLine.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "number"
}) {
  const id = `intrastat-${label.toLowerCase().replace(/\W+/g, "-")}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function emptyForm(): FormState {
  return {
    cn_code: "",
    description: "",
    net_weight: "",
    origin_country: "",
    delivery_terms: "",
    vat_number: "",
    quantity: "",
    value: "",
    currency: "",
  }
}

function valueToString(value: number | null): string {
  return value == null ? "" : String(value)
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function nullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
