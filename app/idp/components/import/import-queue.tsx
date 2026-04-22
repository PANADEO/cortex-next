"use client"

import { toastApiError, useImportMultiplePackages, useImportPackage } from "@cortex/api"
import { Button } from "@cortex/ui"
import { Loader2, Send } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { emptyImportOptions, type ImportOptions } from "@/components/import-options-fields"
import { detectIntakeKind } from "./file-intake"
import { ImportSlot, type ImportSlotValue } from "./import-slot"

function makeEmptySlot(): ImportSlotValue {
  return {
    id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    files: [],
    options: { ...emptyImportOptions },
    status: "pending",
  }
}

export function ImportQueue() {
  const [slots, setSlots] = useState<ImportSlotValue[]>(() => [makeEmptySlot()])
  const importOne = useImportPackage()
  const importMany = useImportMultiplePackages()

  const patchSlot = useCallback(
    (id: string, patch: Partial<ImportSlotValue>) => {
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    },
    [],
  )

  const ensureTrailingEmpty = useCallback(() => {
    setSlots((prev) => {
      const last = prev[prev.length - 1]
      if (last && (last.files.length > 0 || last.status !== "pending")) {
        return [...prev, makeEmptySlot()]
      }
      return prev
    })
  }, [])

  const setFiles = useCallback(
    (id: string, files: File[]) => {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                files,
                status: files.length === 0 ? "pending" : "ready",
                errorMessage: undefined,
              }
            : s,
        ),
      )
      if (files.length > 0) ensureTrailingEmpty()
    },
    [ensureTrailingEmpty],
  )

  const setOptions = useCallback(
    (id: string, patch: Partial<ImportOptions>) => {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, options: { ...s.options, ...patch } } : s,
        ),
      )
    },
    [],
  )

  const removeSlot = useCallback((id: string) => {
    setSlots((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0 || next[next.length - 1]!.files.length > 0) {
        next.push(makeEmptySlot())
      }
      return next
    })
  }, [])

  const submitSlot = useCallback(
    async (slot: ImportSlotValue) => {
      if (slot.files.length === 0) return
      const kind = detectIntakeKind(slot.files)
      const serialized = {
        fast_processing: slot.options.fast_processing,
        additional_ai_context_enabled: slot.options.additional_ai_context_enabled,
        additional_ai_context:
          slot.options.additional_ai_context_enabled &&
          slot.options.additional_ai_context.trim()
            ? slot.options.additional_ai_context.trim()
            : null,
      }
      patchSlot(slot.id, { status: "uploading", errorMessage: undefined })
      try {
        if (kind === "zip") {
          await importOne.mutateAsync({ file: slot.files[0]!, ...serialized })
          toast.success(`Imported ${slot.files[0]!.name}`)
        } else {
          await importMany.mutateAsync({ files: slot.files, ...serialized })
          toast.success(`Imported ${slot.files.length} file(s)`)
        }
        patchSlot(slot.id, { status: "done" })
      } catch (err) {
        toastApiError(err)
        const message =
          err instanceof Error ? err.message : "Upload failed — please retry."
        patchSlot(slot.id, { status: "error", errorMessage: message })
      }
    },
    [importOne, importMany, patchSlot],
  )

  const submitAll = useCallback(async () => {
    const targets = slots.filter((s) => s.status === "ready" || s.status === "error")
    if (targets.length === 0) return
    await Promise.all(targets.map(submitSlot))
  }, [slots, submitSlot])

  const pendingCount = useMemo(
    () => slots.filter((s) => s.status === "ready" || s.status === "error").length,
    [slots],
  )

  const doneCount = useMemo(
    () => slots.filter((s) => s.status === "done").length,
    [slots],
  )

  const isUploading = importOne.isPending || importMany.isPending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {slots.map((slot, idx) => (
          <ImportSlot
            key={slot.id}
            slot={slot}
            canRemove={slots.length > 1 || idx > 0}
            onFilesChange={(files) => setFiles(slot.id, files)}
            onOptionsChange={(patch) => setOptions(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
            onSubmit={() => submitSlot(slot)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {pendingCount === 0 && doneCount === 0
            ? "Drop a ZIP, files or folders to start — a new slot appears automatically."
            : null}
          {pendingCount > 0 ? (
            <>
              <span className="font-medium text-foreground">{pendingCount}</span>{" "}
              ready to import
            </>
          ) : null}
          {doneCount > 0 ? (
            <span className="ml-2 text-emerald-600">· {doneCount} imported</span>
          ) : null}
        </div>
        <Button
          onClick={submitAll}
          disabled={pendingCount === 0 || isUploading}
          className="h-9"
        >
          {isUploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          Import all
        </Button>
      </div>
    </div>
  )
}
