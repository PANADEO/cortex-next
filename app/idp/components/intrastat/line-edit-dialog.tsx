"use client"

import { formatIntrastatError, isIntrastatErrorDetail } from "@/lib/intrastat/api"
import {
  useIntrastatCnSuggestions,
  useIntrastatPatchLine,
  useIntrastatUpsertCnResourceRow,
} from "@/lib/intrastat/hooks"
import type {
  IntrastatCnSuggestion,
  IntrastatDeclarationLine,
  IntrastatLinePatchRequest,
} from "@/lib/intrastat/types"
import { useAuthorizedApps } from "@cortex/api"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

interface Props {
  batchId: string
  line: IntrastatDeclarationLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CN_EDITOR_APP_CODE = "intrastat-cn-editor"

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
  const access = useAuthorizedApps()
  const patchLine = useIntrastatPatchLine(batchId)
  const upsertCnResourceRow = useIntrastatUpsertCnResourceRow()
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const canEditCnResource = access.apps.includes(CN_EDITOR_APP_CODE)
  const cn8 = normalizedCn8(form.cn_code)
  const canSaveToCnResource = Boolean(line?.item_index.trim() && cn8 && form.description.trim())
  const isSaving = patchLine.isPending || upsertCnResourceRow.isPending
  const suggestionSearch = useMemo(
    () => (form.cn_code.trim() || line?.item_index || form.description).trim(),
    [form.cn_code, form.description, line?.item_index],
  )
  const suggestions = useIntrastatCnSuggestions(
    suggestionSearch,
    open && Boolean(line) && suggestionSearch.length >= 2,
  )

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

  const applySuggestion = (suggestion: IntrastatCnSuggestion) => {
    setForm((current) => ({
      ...current,
      cn_code: suggestion.cn8 ?? suggestion.cn ?? current.cn_code,
      description: suggestion.description ?? current.description,
    }))
  }

  const handleSave = async (saveToCnResource: boolean) => {
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

      if (saveToCnResource && canEditCnResource && canSaveToCnResource && cn8) {
        const resourcePayload = {
          index_value: line.item_index,
          cn8,
          cn: cn8,
          description: form.description.trim(),
        }
        try {
          await upsertCnResourceRow.mutateAsync({ payload: resourcePayload })
        } catch (error) {
          if (!isIntrastatErrorDetail(error, "cn-resource-index-conflict")) {
            toast.error(formatIntrastatError(error, "Line updated, but CN database update failed"))
            return
          }

          const shouldReplace = window.confirm(
            `Index ${line.item_index} already has a different CN code. Replace it with ${cn8}?`,
          )
          if (!shouldReplace) {
            toast.success("Intrastat line updated; CN database unchanged")
            onOpenChange(false)
            return
          }
          try {
            await upsertCnResourceRow.mutateAsync({
              payload: resourcePayload,
              replaceConflict: true,
            })
          } catch (replaceError) {
            toast.error(
              formatIntrastatError(replaceError, "Line updated, but CN database update failed"),
            )
            return
          }
        }
        toast.success("Intrastat line and CN database updated")
      } else {
        toast.success("Intrastat line updated")
      }
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
          <DialogDescription>
            Correct the declaration line and optionally reuse the index-to-CN mapping in future
            invoices.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="intrastat-cn-code">CN code</Label>
            <Input
              id="intrastat-cn-code"
              value={form.cn_code}
              onChange={(event) => update("cn_code", event.target.value)}
            />
            <CnSuggestionList
              suggestions={suggestions.data?.items ?? []}
              isLoading={suggestions.isFetching}
              onSelect={applySuggestion}
            />
          </div>
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
          {canEditCnResource ? (
            <>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
                Save line only
              </Button>
              <Button onClick={() => handleSave(true)} disabled={isSaving || !canSaveToCnResource}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save and add to CN database
              </Button>
            </>
          ) : (
            <Button onClick={() => handleSave(false)} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save line
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CnSuggestionList({
  suggestions,
  isLoading,
  onSelect,
}: {
  suggestions: IntrastatCnSuggestion[]
  isLoading: boolean
  onSelect: (suggestion: IntrastatCnSuggestion) => void
}) {
  if (suggestions.length === 0 && !isLoading) return null

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          className="grid w-full grid-cols-[88px_minmax(80px,120px)_minmax(0,1fr)] gap-3 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:grid-cols-[110px_160px_minmax(0,1fr)]"
          onClick={() => onSelect(suggestion)}
        >
          <span className="font-mono font-medium">{suggestion.cn8 ?? suggestion.cn ?? "—"}</span>
          <span className="truncate font-mono text-muted-foreground">{suggestion.index_value}</span>
          <span className="truncate text-muted-foreground">{suggestion.description ?? "—"}</span>
        </button>
      ))}
      {isLoading && suggestions.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">Loading suggestions...</div>
      ) : null}
    </div>
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

function normalizedCn8(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 8 ? digits.slice(0, 8) : null
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
