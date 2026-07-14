"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import {
  useIntrastatCreateCnResourceRow,
  useIntrastatUpdateCnResourceRow,
} from "@/lib/intrastat/hooks"
import type { IntrastatCnResourceRow, IntrastatCnResourceRowRequest } from "@/lib/intrastat/types"
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
  Textarea,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface Props {
  row: IntrastatCnResourceRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  indexValue: string
  cn8: string
  cn: string
  description: string
}

export function IntrastatCnResourceRowDialog({ row, open, onOpenChange }: Props) {
  const createRow = useIntrastatCreateCnResourceRow()
  const updateRow = useIntrastatUpdateCnResourceRow()
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const isSaving = createRow.isPending || updateRow.isPending

  useEffect(() => {
    setForm(
      row
        ? {
            indexValue: row.index_value,
            cn8: row.cn8 ?? "",
            cn: row.cn ?? "",
            description: row.description ?? "",
          }
        : emptyForm(),
    )
  }, [row, open])

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSave = async () => {
    const payload: IntrastatCnResourceRowRequest = {
      index_value: form.indexValue.trim(),
      cn8: form.cn8.trim(),
      cn: form.cn.trim() || null,
      description: form.description.trim(),
    }
    if (!payload.index_value || !/^\d{8}$/.test(payload.cn8) || !payload.description) {
      toast.error("Enter an item index, an 8-digit CN code and a description")
      return
    }

    try {
      if (row) {
        await updateRow.mutateAsync({ rowId: row.id, payload })
        toast.success("CN code updated")
      } else {
        await createRow.mutateAsync(payload)
        toast.success("CN code added")
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(formatIntrastatError(error, "CN code could not be saved"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? "Edit CN code" : "Add CN code"}</DialogTitle>
          <DialogDescription>
            This updates the active CN database and rebuilds its matching index.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cn-resource-index">Item index</Label>
            <Input
              id="cn-resource-index"
              value={form.indexValue}
              onChange={(event) => update("indexValue", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cn-resource-cn8">CN code (8 digits)</Label>
            <Input
              id="cn-resource-cn8"
              inputMode="numeric"
              maxLength={8}
              value={form.cn8}
              onChange={(event) => update("cn8", event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cn-resource-cn">Additional CN code</Label>
            <Input
              id="cn-resource-cn"
              inputMode="numeric"
              value={form.cn}
              onChange={(event) => update("cn", event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cn-resource-description">Description</Label>
            <Textarea
              id="cn-resource-description"
              rows={3}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function emptyForm(): FormState {
  return { indexValue: "", cn8: "", cn: "", description: "" }
}
