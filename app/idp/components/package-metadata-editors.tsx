"use client"

import {
  toastApiError,
  useSetAdditionalAiContext,
  useSetCustomStatus,
  useSetUserNotes,
} from "@cortex/api"
import { Button, Input, Label, Textarea } from "@cortex/ui"
import { formatRelative } from "@cortex/utils"
import { Check, Loader2, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const MAX_AI_CONTEXT = 4000

interface PackageMetadataEditorsProps {
  packageId: string
  customStatus: string | null
  userNotes: string | null
  additionalAiContext: string | null
  userNotesUpdated?: string | null
}

export function PackageMetadataEditors({
  packageId,
  customStatus,
  userNotes,
  additionalAiContext,
  userNotesUpdated,
}: PackageMetadataEditorsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CustomStatusField packageId={packageId} initial={customStatus} />
        <UserNotesField
          packageId={packageId}
          initial={userNotes}
          lastUpdated={userNotesUpdated ?? null}
        />
      </div>
      <AdditionalAiContextField packageId={packageId} initial={additionalAiContext} />
    </div>
  )
}

function CustomStatusField({ packageId, initial }: { packageId: string; initial: string | null }) {
  const { t } = useTranslation("idp")
  const [value, setValue] = useState(initial ?? "")
  const [savedValue, setSavedValue] = useState(initial ?? "")
  const mutate = useSetCustomStatus(packageId)

  useEffect(() => {
    const next = initial ?? ""
    setValue(next)
    setSavedValue(next)
  }, [initial])

  const dirty = value !== savedValue
  const normalized = value.trim() === "" ? null : value.trim()

  const handleSave = async () => {
    try {
      await mutate.mutateAsync({ custom_status: normalized })
      const next = normalized ?? ""
      setValue(next)
      setSavedValue(next)
      toast.success(t("packages.metadata.customStatusSaved"))
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`custom-status-${packageId}`} className="text-xs">
        {t("packages.metadata.customStatusLabel")}
      </Label>
      <div className="flex gap-2">
        <Input
          id={`custom-status-${packageId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("packages.metadata.customStatusPlaceholder")}
          maxLength={120}
          className="h-9 flex-1"
        />
        <Button size="sm" onClick={handleSave} disabled={!dirty || mutate.isPending}>
          <span className="sr-only">{t("packages.metadata.saveCustomStatus")}</span>
          {mutate.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

function AdditionalAiContextField({
  packageId,
  initial,
}: {
  packageId: string
  initial: string | null
}) {
  const { t } = useTranslation("idp")
  const [value, setValue] = useState(initial ?? "")
  const [savedValue, setSavedValue] = useState(initial ?? "")
  const mutate = useSetAdditionalAiContext(packageId)

  useEffect(() => {
    const next = initial ?? ""
    setValue(next)
    setSavedValue(next)
  }, [initial])

  const dirty = value !== savedValue
  const normalized = value.trim() === "" ? null : value

  const handleSave = async () => {
    try {
      await mutate.mutateAsync({ additional_ai_context: normalized })
      const next = normalized ?? ""
      setValue(next)
      setSavedValue(next)
      toast.success(t("packages.metadata.aiContextSaved"))
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`ai-context-${packageId}`} className="flex items-center gap-1.5 text-xs">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        {t("packages.metadata.aiContextLabel")}
      </Label>
      <Textarea
        id={`ai-context-${packageId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("packages.metadata.aiContextPlaceholder")}
        rows={4}
        maxLength={MAX_AI_CONTEXT}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          {t("packages.metadata.aiContextHint", { used: value.length, max: MAX_AI_CONTEXT })}
        </p>
        <Button size="sm" onClick={handleSave} disabled={!dirty || mutate.isPending}>
          {mutate.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("packages.metadata.saveAiContext")}
        </Button>
      </div>
    </div>
  )
}

function UserNotesField({
  packageId,
  initial,
  lastUpdated,
}: {
  packageId: string
  initial: string | null
  lastUpdated: string | null
}) {
  const { t } = useTranslation("idp")
  const [value, setValue] = useState(initial ?? "")
  const [savedValue, setSavedValue] = useState(initial ?? "")
  const mutate = useSetUserNotes(packageId)

  useEffect(() => {
    const next = initial ?? ""
    setValue(next)
    setSavedValue(next)
  }, [initial])

  const dirty = value !== savedValue
  const normalized = value.trim() === "" ? null : value

  const handleSave = async () => {
    try {
      await mutate.mutateAsync({ user_notes: normalized })
      const next = normalized ?? ""
      setValue(next)
      setSavedValue(next)
      toast.success(t("packages.metadata.notesSaved"))
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`user-notes-${packageId}`} className="text-xs">
        {t("packages.metadata.notesLabel")}
      </Label>
      <Textarea
        id={`user-notes-${packageId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("packages.metadata.notesPlaceholder")}
        rows={3}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          {lastUpdated
            ? t("packages.metadata.lastUpdated", { when: formatRelative(lastUpdated) })
            : ""}
        </p>
        <Button size="sm" onClick={handleSave} disabled={!dirty || mutate.isPending}>
          {mutate.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("packages.metadata.saveNotes")}
        </Button>
      </div>
    </div>
  )
}
