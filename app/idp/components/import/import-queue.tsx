"use client"

import {
  emptyImportOptions,
  serializeImportOptions,
  type ImportOptions,
} from "@/components/import-options-fields"
import {
  loadExportEmailRecipients,
  loadImportNotificationExportTemplate,
  normalizeExportEmailRecipient,
  rememberExportEmailRecipient,
  rememberImportNotificationExportTemplate,
} from "@/lib/export/email-recipients"
import {
  toastApiError,
  useExportTemplates,
  useImportEmailPackage,
  useImportMultiplePackages,
  useImportPackage,
  useMe,
} from "@cortex/api"
import { Button } from "@cortex/ui"
import { useFeatureFlag } from "@cortex/utils"
import { Loader2, Send } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { detectIntakeKind } from "./file-intake"
import { ImportSlot, type ImportSlotValue } from "./import-slot"

function makeEmptySlot(
  defaultNotificationEmail = "",
  defaultNotificationExportTemplate = "",
): ImportSlotValue {
  return {
    id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    files: [],
    packageName: "",
    notificationEmailEnabled: false,
    notificationEmail: defaultNotificationEmail,
    notificationExportTemplate: defaultNotificationExportTemplate,
    options: { ...emptyImportOptions },
    status: "pending",
  }
}

export function ImportQueue() {
  const [slots, setSlots] = useState<ImportSlotValue[]>(() => [makeEmptySlot()])
  const [savedDefaultEmail, setSavedDefaultEmail] = useState("")
  const [savedDefaultExportTemplate, setSavedDefaultExportTemplate] = useState("")
  const previousDefaultsRef = useRef({ email: "", exportTemplate: "" })
  const me = useMe()
  const importOne = useImportPackage()
  const importEmail = useImportEmailPackage()
  const importMany = useImportMultiplePackages()
  const exportTemplates = useExportTemplates()
  const showAtrProcessing = useFeatureFlag("idp.atr-processing")
  const showAdditionalAiContext = useFeatureFlag("idp.additional-ai-context")
  const showPackagingSelectionMode = useFeatureFlag("idp.packaging-selection-mode")
  const showImportEmailNotifications = useFeatureFlag("idp.import-email-notifications")
  const userEmail = me.data?.email ?? ""
  const defaultNotificationEmail =
    savedDefaultEmail || normalizeExportEmailRecipient(userEmail) || ""
  const notificationExportTemplates = exportTemplates.data ?? []
  const defaultNotificationExportTemplate =
    notificationExportTemplates.find((template) => template.name === savedDefaultExportTemplate)
      ?.name ??
    notificationExportTemplates.find((template) => template.name === "sad_xml")?.name ??
    notificationExportTemplates[0]?.name ??
    ""

  useEffect(() => {
    setSavedDefaultEmail(loadExportEmailRecipients(userEmail)[0] ?? "")
    setSavedDefaultExportTemplate(loadImportNotificationExportTemplate(userEmail))
  }, [userEmail])

  useEffect(() => {
    if (!defaultNotificationEmail && !defaultNotificationExportTemplate) return
    const previousDefaults = previousDefaultsRef.current
    previousDefaultsRef.current = {
      email: defaultNotificationEmail,
      exportTemplate: defaultNotificationExportTemplate,
    }
    setSlots((prev) =>
      prev.map((slot) => {
        const shouldUseDefaultEmail =
          !slot.notificationEmail || slot.notificationEmail === previousDefaults.email
        const shouldUseDefaultExportTemplate =
          !slot.notificationExportTemplate ||
          slot.notificationExportTemplate === previousDefaults.exportTemplate

        return {
          ...slot,
          notificationEmail: shouldUseDefaultEmail
            ? defaultNotificationEmail
            : slot.notificationEmail,
          notificationExportTemplate: shouldUseDefaultExportTemplate
            ? defaultNotificationExportTemplate
            : slot.notificationExportTemplate,
        }
      }),
    )
  }, [defaultNotificationEmail, defaultNotificationExportTemplate])

  const patchSlot = useCallback((id: string, patch: Partial<ImportSlotValue>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const ensureTrailingEmpty = useCallback(() => {
    setSlots((prev) => {
      const last = prev[prev.length - 1]
      if (last && (last.files.length > 0 || last.status !== "pending")) {
        return [...prev, makeEmptySlot(defaultNotificationEmail, defaultNotificationExportTemplate)]
      }
      return prev
    })
  }, [defaultNotificationEmail, defaultNotificationExportTemplate])

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

  const setOptions = useCallback((id: string, patch: Partial<ImportOptions>) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, options: { ...s.options, ...patch } } : s)),
    )
  }, [])

  const setPackageName = useCallback((id: string, packageName: string) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, packageName } : s)))
  }, [])

  const removeSlot = useCallback(
    (id: string) => {
      setSlots((prev) => {
        const next = prev.filter((s) => s.id !== id)
        if (next.length === 0 || next[next.length - 1]!.files.length > 0) {
          next.push(makeEmptySlot(defaultNotificationEmail, defaultNotificationExportTemplate))
        }
        return next
      })
    },
    [defaultNotificationEmail, defaultNotificationExportTemplate],
  )

  const setNotificationEmailEnabled = useCallback((id: string, enabled: boolean) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notificationEmailEnabled: enabled } : s)),
    )
  }, [])

  const setNotificationEmail = useCallback((id: string, email: string) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, notificationEmail: email } : s)))
  }, [])

  const setNotificationExportTemplate = useCallback((id: string, templateName: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notificationExportTemplate: templateName } : s)),
    )
  }, [])

  const submitSlot = useCallback(
    async (slot: ImportSlotValue) => {
      if (slot.files.length === 0) return
      const kind = detectIntakeKind(slot.files)
      const serialized = serializeImportOptions(slot.options, {
        atrProcessingAvailable: showAtrProcessing,
        additionalAiContextAvailable: showAdditionalAiContext,
        packagingSelectionModeAvailable: showPackagingSelectionMode,
      })
      const packageName = slot.packageName.trim() || null
      const notificationEmail =
        showImportEmailNotifications && slot.notificationEmailEnabled
          ? normalizeExportEmailRecipient(slot.notificationEmail)
          : null
      if (showImportEmailNotifications && slot.notificationEmailEnabled && !notificationEmail) {
        const message = "Enter a valid notification email."
        toast.error(message)
        patchSlot(slot.id, { status: "error", errorMessage: message })
        return
      }
      const notificationExportTemplate =
        showImportEmailNotifications && slot.notificationEmailEnabled
          ? slot.notificationExportTemplate || defaultNotificationExportTemplate
          : null
      if (
        showImportEmailNotifications &&
        slot.notificationEmailEnabled &&
        !notificationExportTemplate
      ) {
        const message = "Select an export template."
        toast.error(message)
        patchSlot(slot.id, { status: "error", errorMessage: message })
        return
      }
      patchSlot(slot.id, { status: "uploading", errorMessage: undefined })
      try {
        let result: { id: string }
        if (kind === "zip") {
          result = await importOne.mutateAsync({
            file: slot.files[0]!,
            package_name: packageName,
            notification_email: notificationEmail,
            notification_export_template: notificationExportTemplate,
            ...serialized,
          })
          toast.success(`Imported ${slot.files[0]!.name}`)
        } else if (kind === "email") {
          result = await importEmail.mutateAsync({
            file: slot.files[0]!,
            package_name: packageName,
            notification_email: notificationEmail,
            notification_export_template: notificationExportTemplate,
            ...serialized,
          })
          toast.success(`Imported email ${slot.files[0]!.name}`)
        } else {
          result = await importMany.mutateAsync({
            files: slot.files,
            package_name: packageName,
            notification_email: notificationEmail,
            notification_export_template: notificationExportTemplate,
            ...serialized,
          })
          toast.success(`Imported ${slot.files.length} file(s)`)
        }
        if (notificationEmail) {
          setSavedDefaultEmail(rememberExportEmailRecipient(notificationEmail, userEmail)[0] ?? "")
        }
        if (notificationExportTemplate) {
          setSavedDefaultExportTemplate(
            rememberImportNotificationExportTemplate(notificationExportTemplate, userEmail),
          )
        }
        patchSlot(slot.id, { status: "done", packageId: result.id })
      } catch (err) {
        toastApiError(err)
        const message = err instanceof Error ? err.message : "Upload failed — please retry."
        patchSlot(slot.id, { status: "error", errorMessage: message })
      }
    },
    [
      importOne,
      importEmail,
      importMany,
      patchSlot,
      showAtrProcessing,
      showAdditionalAiContext,
      showPackagingSelectionMode,
      showImportEmailNotifications,
      defaultNotificationExportTemplate,
      userEmail,
    ],
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

  const doneCount = useMemo(() => slots.filter((s) => s.status === "done").length, [slots])

  const isUploading = importOne.isPending || importEmail.isPending || importMany.isPending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {slots.map((slot, idx) => (
          <ImportSlot
            key={slot.id}
            slot={slot}
            canRemove={slots.length > 1 || idx > 0}
            onFilesChange={(files) => setFiles(slot.id, files)}
            onPackageNameChange={(packageName) => setPackageName(slot.id, packageName)}
            onNotificationEmailEnabledChange={(enabled) =>
              setNotificationEmailEnabled(slot.id, enabled)
            }
            onNotificationEmailChange={(email) => setNotificationEmail(slot.id, email)}
            onNotificationExportTemplateChange={(templateName) =>
              setNotificationExportTemplate(slot.id, templateName)
            }
            onOptionsChange={(patch) => setOptions(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
            onSubmit={() => submitSlot(slot)}
            notificationExportTemplates={notificationExportTemplates}
            showImportEmailNotifications={showImportEmailNotifications}
            showAtrProcessing={showAtrProcessing}
            showAdditionalAiContext={showAdditionalAiContext}
            showPackagingSelectionMode={showPackagingSelectionMode}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {pendingCount === 0 && doneCount === 0
            ? "Drop a ZIP, EML, MSG, files or folders to start — a new slot appears automatically."
            : null}
          {pendingCount > 0 ? (
            <>
              <span className="font-medium text-foreground">{pendingCount}</span> ready to import
            </>
          ) : null}
          {doneCount > 0 ? (
            <span className="ml-2 text-emerald-600">· {doneCount} imported</span>
          ) : null}
        </div>
        <Button onClick={submitAll} disabled={pendingCount === 0 || isUploading} className="h-9">
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
