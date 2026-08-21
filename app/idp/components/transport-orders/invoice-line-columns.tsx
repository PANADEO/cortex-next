"use client"

import { ApiError, useSetUserPreferences, useUserPreferences } from "@cortex/api"
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
import { useTranslation } from "react-i18next"

export interface InvoiceLineColumnConfig {
  key: InvoiceLineColumnKey
  width: number
  uppercase?: boolean
  numeric?: boolean
}

/**
 * Napis kolumny bierze się z klucza, nie z konfiguracji — ta sama kolumna ma
 * trzy długości (pełna w oknie wyboru, skrócona w tabeli, najkrótsza w
 * arkuszu), więc wariant jest częścią klucza.
 */
export function invoiceLineColumnLabelKey(
  key: string,
  variant: "label" | "grid" | "sheet" = "label",
): string {
  return `transportOrders.lineColumns.${key}.${variant}`
}

export const INVOICE_LINE_COLUMNS: readonly InvoiceLineColumnConfig[] = [
  { key: "line_number", width: 56, numeric: true },
  { key: "po_number", width: 150 },
  { key: "product_code", width: 160 },
  { key: "description", width: 320 },
  { key: "description_pl", width: 240 },
  { key: "customs_code", width: 132 },
  { key: "preference_code", width: 72 },
  { key: "atr_documents", width: 220 },
  { key: "quantity", width: 90, numeric: true },
  { key: "unit_of_measure", width: 80 },
  { key: "invoice_value", width: 120, numeric: true },
  { key: "net_weight_kg", width: 130, numeric: true },
  { key: "gross_weight_kg", width: 140, numeric: true },
  { key: "estimated_gross_weight_kg", width: 150, numeric: true },
  { key: "packages_quantity", width: 100, numeric: true },
  { key: "packages_type", width: 120 },
  { key: "packages_marking", width: 150 },
  { key: "origin_country", width: 90, uppercase: true },
]

const ALL_COLUMN_KEYS = new Set<InvoiceLineColumnKey>(INVOICE_LINE_COLUMN_KEYS)
const ATR_COLUMN_KEYS = new Set<InvoiceLineColumnKey>(["preference_code", "atr_documents"])
const LOCAL_ONLY_COLUMN_KEYS = new Set<InvoiceLineColumnKey>(["description_pl"])
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

function mergeLocalOnlyHiddenColumns(
  apiHiddenColumns: InvoiceLineColumnKey[],
  storedHiddenColumns: InvoiceLineColumnKey[],
): InvoiceLineColumnKey[] {
  const next = new Set(apiHiddenColumns)
  for (const key of storedHiddenColumns) {
    if (LOCAL_ONLY_COLUMN_KEYS.has(key)) next.add(key)
  }
  return Array.from(next)
}

function getBackendHiddenColumns(hiddenColumns: InvoiceLineColumnKey[] | null) {
  const supported = (hiddenColumns ?? []).filter((key) => !LOCAL_ONLY_COLUMN_KEYS.has(key))
  return supported.length > 0 ? supported : null
}

function canFallbackToLocalHiddenColumns(
  error: unknown,
  hiddenColumns: InvoiceLineColumnKey[] | null,
): boolean {
  return (
    error instanceof ApiError &&
    error.status === 422 &&
    Boolean(hiddenColumns?.some((key) => LOCAL_ONLY_COLUMN_KEYS.has(key)))
  )
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
    const mergedHiddenColumns = mergeLocalOnlyHiddenColumns(
      apiHiddenColumns,
      readStoredHiddenColumns(),
    )
    writeStoredHiddenColumns(mergedHiddenColumns.length > 0 ? mergedHiddenColumns : null)
  }, [preferences.data])

  const hiddenColumnValues = useMemo(() => {
    if (!preferencesIncludeInvoiceLineColumns(preferences.data)) return storedHiddenColumns
    return mergeLocalOnlyHiddenColumns(
      getInvoiceLineHiddenColumns(preferences.data),
      storedHiddenColumns,
    )
  }, [preferences.data, storedHiddenColumns])
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
  const { t } = useTranslation(["idp", "common"])
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
    try {
      await persist.mutateAsync({ invoice_line_hidden_columns: hiddenColumns })
    } catch (error) {
      if (!canFallbackToLocalHiddenColumns(error, hiddenColumns)) throw error
      writeStoredHiddenColumns(hiddenColumns)
      await persist.mutateAsync({
        invoice_line_hidden_columns: getBackendHiddenColumns(hiddenColumns),
      })
    }
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
          aria-label={t("transportOrders.columnsDialog.trigger")}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          {t("transportOrders.columnsDialog.triggerLabel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("transportOrders.columnsDialog.title")}</DialogTitle>
          <DialogDescription>{t("transportOrders.columnsDialog.description")}</DialogDescription>
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
                  aria-label={t(invoiceLineColumnLabelKey(column.key))}
                />
                <span>{t(invoiceLineColumnLabelKey(column.key))}</span>
              </Label>
            )
          })}
        </div>
        {visibleCount === 0 ? (
          <p className="text-xs text-destructive">
            {t("transportOrders.columnsDialog.atLeastOne")}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={persist.isPending}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={persist.isPending}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            {t("transportOrders.columnsDialog.resetDefaults")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {persist.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
