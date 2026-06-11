"use client"

import { useSetUserPreferences, useUserPreferences } from "@cortex/api"
import {
  INVOICE_LINE_COLUMN_KEYS,
  type InvoiceLineColumnKey,
  type UserPreferencesResponse,
} from "@cortex/types"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Loader2, RotateCcw, Settings2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

export interface InvoiceLineColumnConfig {
  key: InvoiceLineColumnKey
  label: string
  gridLabel: string
  spreadsheetLabel: string
  width: number
  uppercase?: boolean
  numeric?: boolean
}

export const INVOICE_LINE_COLUMNS: readonly InvoiceLineColumnConfig[] = [
  {
    key: "line_number",
    label: "Line #",
    gridLabel: "#",
    spreadsheetLabel: "#",
    width: 56,
    numeric: true,
  },
  {
    key: "po_number",
    label: "PO number",
    gridLabel: "PO Number",
    spreadsheetLabel: "PO",
    width: 150,
  },
  {
    key: "product_code",
    label: "Product code",
    gridLabel: "Product Code",
    spreadsheetLabel: "Product",
    width: 160,
  },
  {
    key: "description",
    label: "Description",
    gridLabel: "Description",
    spreadsheetLabel: "Description",
    width: 320,
  },
  {
    key: "description_pl",
    label: "Polish name",
    gridLabel: "Polish Name",
    spreadsheetLabel: "Polish Name",
    width: 240,
  },
  {
    key: "customs_code",
    label: "Customs code",
    gridLabel: "Customs Code",
    spreadsheetLabel: "Customs Code",
    width: 132,
  },
  {
    key: "preference_code",
    label: "Preference code",
    gridLabel: "Pref.",
    spreadsheetLabel: "Pref.",
    width: 72,
  },
  {
    key: "atr_documents",
    label: "ATR documents",
    gridLabel: "ATR",
    spreadsheetLabel: "ATR",
    width: 220,
  },
  {
    key: "quantity",
    label: "Quantity",
    gridLabel: "Qty",
    spreadsheetLabel: "Qty",
    width: 90,
    numeric: true,
  },
  {
    key: "unit_of_measure",
    label: "Unit of measure",
    gridLabel: "UoM",
    spreadsheetLabel: "UoM",
    width: 80,
  },
  {
    key: "invoice_value",
    label: "Invoice value",
    gridLabel: "Value",
    spreadsheetLabel: "Value",
    width: 120,
    numeric: true,
  },
  {
    key: "net_weight_kg",
    label: "Net weight (kg)",
    gridLabel: "Net Wt (kg)",
    spreadsheetLabel: "Net kg",
    width: 130,
    numeric: true,
  },
  {
    key: "gross_weight_kg",
    label: "Gross weight (kg)",
    gridLabel: "Gross Wt (kg)",
    spreadsheetLabel: "Gross kg",
    width: 140,
    numeric: true,
  },
  {
    key: "estimated_gross_weight_kg",
    label: "Estimated gross weight (kg)",
    gridLabel: "Est. Gross Wt (kg)",
    spreadsheetLabel: "Est. gross kg",
    width: 150,
    numeric: true,
  },
  {
    key: "packages_quantity",
    label: "Packages quantity",
    gridLabel: "Packages Qty",
    spreadsheetLabel: "Pkg qty",
    width: 100,
    numeric: true,
  },
  {
    key: "packages_type",
    label: "Packages type",
    gridLabel: "Packages Type",
    spreadsheetLabel: "Pkg type",
    width: 120,
  },
  {
    key: "packages_marking",
    label: "Packages marking",
    gridLabel: "Packages Marking",
    spreadsheetLabel: "Pkg mark",
    width: 150,
  },
  {
    key: "origin_country",
    label: "Origin country",
    gridLabel: "Origin",
    spreadsheetLabel: "Origin",
    width: 90,
    uppercase: true,
  },
]

const ALL_COLUMN_KEYS = new Set<InvoiceLineColumnKey>(INVOICE_LINE_COLUMN_KEYS)
const ATR_COLUMN_KEYS = new Set<InvoiceLineColumnKey>(["preference_code", "atr_documents"])
const STORAGE_KEY = "idp.invoiceLineHiddenColumns"
const STORAGE_EVENT = "idp:invoice-line-hidden-columns"

export function getInvoiceLineHiddenColumns(
  preferences: UserPreferencesResponse | undefined,
): InvoiceLineColumnKey[] {
  return (preferences?.invoice_line_hidden_columns ?? []).filter((key) => ALL_COLUMN_KEYS.has(key))
}

export function getAvailableInvoiceLineColumns(showAtrColumns = true) {
  return showAtrColumns
    ? INVOICE_LINE_COLUMNS
    : INVOICE_LINE_COLUMNS.filter((column) => !ATR_COLUMN_KEYS.has(column.key))
}

function preferencesIncludeInvoiceLineColumns(
  preferences: UserPreferencesResponse | undefined,
): preferences is UserPreferencesResponse {
  return Boolean(
    preferences && Object.prototype.hasOwnProperty.call(preferences, "invoice_line_hidden_columns"),
  )
}

function normalizeHiddenColumns(value: unknown): InvoiceLineColumnKey[] {
  return Array.isArray(value) ? value.filter((key) => ALL_COLUMN_KEYS.has(key)) : []
}

function readStoredHiddenColumns(): InvoiceLineColumnKey[] {
  const storage = getLocalStorage()
  if (!storage) return []
  try {
    return normalizeHiddenColumns(JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]"))
  } catch {
    return []
  }
}

function writeStoredHiddenColumns(hiddenColumns: InvoiceLineColumnKey[] | null) {
  if (typeof window === "undefined") return
  const storage = getLocalStorage()
  if (!storage) {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: hiddenColumns ?? [] }))
    return
  }
  if (hiddenColumns && hiddenColumns.length > 0) {
    storage.setItem(STORAGE_KEY, JSON.stringify(hiddenColumns))
  } else {
    storage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: hiddenColumns ?? [] }))
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null
  const storage = window.localStorage
  return storage &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function"
    ? storage
    : null
}

export function useVisibleInvoiceLineColumns(showAtrColumns = true) {
  const preferences = useUserPreferences()
  const [storedHiddenColumns, setStoredHiddenColumns] = useState<InvoiceLineColumnKey[]>(() =>
    readStoredHiddenColumns(),
  )

  useEffect(() => {
    const onStorageChange = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>
      setStoredHiddenColumns(normalizeHiddenColumns(customEvent.detail))
    }
    window.addEventListener(STORAGE_EVENT, onStorageChange)
    return () => window.removeEventListener(STORAGE_EVENT, onStorageChange)
  }, [])

  useEffect(() => {
    if (!preferencesIncludeInvoiceLineColumns(preferences.data)) return
    const apiHiddenColumns = getInvoiceLineHiddenColumns(preferences.data)
    writeStoredHiddenColumns(apiHiddenColumns.length > 0 ? apiHiddenColumns : null)
  }, [preferences.data])

  const hiddenColumnValues = useMemo(
    () =>
      preferencesIncludeInvoiceLineColumns(preferences.data)
        ? getInvoiceLineHiddenColumns(preferences.data)
        : storedHiddenColumns,
    [preferences.data, storedHiddenColumns],
  )
  const hiddenColumns = useMemo(() => new Set(hiddenColumnValues), [hiddenColumnValues])
  const availableColumns = useMemo(
    () => getAvailableInvoiceLineColumns(showAtrColumns),
    [showAtrColumns],
  )
  return {
    preferences,
    hiddenColumns,
    columns: useMemo(
      () => availableColumns.filter((column) => !hiddenColumns.has(column.key)),
      [availableColumns, hiddenColumns],
    ),
  }
}

interface InvoiceLineColumnsDialogProps {
  className?: string
  showAtrColumns?: boolean
}

export function InvoiceLineColumnsDialog({
  className,
  showAtrColumns = true,
}: InvoiceLineColumnsDialogProps) {
  const { hiddenColumns } = useVisibleInvoiceLineColumns(showAtrColumns)
  const availableColumns = useMemo(
    () => getAvailableInvoiceLineColumns(showAtrColumns),
    [showAtrColumns],
  )
  const persist = useSetUserPreferences()
  const [open, setOpen] = useState(false)
  const [draftHiddenColumns, setDraftHiddenColumns] = useState<Set<InvoiceLineColumnKey>>(
    () => new Set(),
  )

  useEffect(() => {
    if (!open) return
    setDraftHiddenColumns(new Set(hiddenColumns))
  }, [hiddenColumns, open])

  const visibleCount = availableColumns.filter(
    (column) => !draftHiddenColumns.has(column.key),
  ).length
  const canSave = visibleCount > 0 && !persist.isPending

  const setColumnVisible = (key: InvoiceLineColumnKey, visible: boolean) => {
    setDraftHiddenColumns((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const saveHiddenColumns = async (hiddenColumns: InvoiceLineColumnKey[] | null) => {
    await persist.mutateAsync({ invoice_line_hidden_columns: hiddenColumns })
    writeStoredHiddenColumns(hiddenColumns)
    setOpen(false)
  }

  const handleSave = async () => {
    if (!canSave) return
    await saveHiddenColumns(draftHiddenColumns.size > 0 ? Array.from(draftHiddenColumns) : null)
  }

  const handleReset = async () => {
    setDraftHiddenColumns(new Set())
    await saveHiddenColumns(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("shrink-0", className)}
          aria-label="Configure invoice line columns"
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invoice line columns</DialogTitle>
          <DialogDescription>
            Choose which invoice line columns are visible in the list and verification workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1">
          {availableColumns.map((column) => {
            const visible = !draftHiddenColumns.has(column.key)
            const disabled = visible && visibleCount === 1
            return (
              <Label
                key={column.key}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-normal",
                  disabled && "cursor-not-allowed opacity-70",
                )}
              >
                <Checkbox
                  checked={visible}
                  disabled={disabled}
                  onCheckedChange={(checked) => setColumnVisible(column.key, checked === true)}
                  aria-label={column.label}
                />
                <span>{column.label}</span>
              </Label>
            )
          })}
        </div>
        {visibleCount === 0 ? (
          <p className="text-xs text-destructive">
            At least one invoice line column must stay visible.
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={persist.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={persist.isPending}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset defaults
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {persist.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
