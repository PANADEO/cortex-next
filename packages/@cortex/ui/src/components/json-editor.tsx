"use client"

import { cn } from "@cortex/utils"
import { AlertCircle, Check, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"

interface JsonEditorProps {
  value: unknown
  onSave?: (parsed: unknown, raw: string) => void | Promise<void>
  saveLabel?: string
  disabledReason?: string | undefined
  readOnly?: boolean
  isSaving?: boolean
  className?: string | undefined
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return ""
  }
}

export function JsonEditor({
  value,
  onSave,
  saveLabel,
  disabledReason,
  readOnly = false,
  isSaving = false,
  className,
}: JsonEditorProps) {
  const { t } = useTranslation(["ui", "common"])
  const initial = useMemo(() => stringify(value), [value])
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(initial)
    setError(null)
  }, [initial])

  const dirty = draft !== initial

  const parse = (): { ok: true; value: unknown } | { ok: false; error: string } => {
    if (!draft.trim()) return { ok: true, value: null }
    try {
      return { ok: true, value: JSON.parse(draft) as unknown }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : t("ui:jsonEditor.invalidJson") }
    }
  }

  const handleSave = async () => {
    if (!onSave) return
    const parsed = parse()
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError(null)
    await onSave(parsed.value, draft)
  }

  const handleRevert = () => {
    setDraft(initial)
    setError(null)
  }

  const canSave = Boolean(onSave) && !readOnly && !disabledReason && dirty && !isSaving

  return (
    <div className={cn("space-y-2", className)}>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (error) setError(null)
        }}
        readOnly={readOnly || Boolean(disabledReason)}
        spellCheck={false}
        className={cn(
          "min-h-[320px] w-full rounded-md border border-border bg-muted/30 p-3 font-mono text-xs",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          (readOnly || disabledReason) && "cursor-not-allowed opacity-75",
        )}
      />
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
          title={disabledReason ?? undefined}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {isSaving ? t("ui:jsonEditor.saving") : (saveLabel ?? t("common:actions.save"))}
        </Button>
        <Button size="sm" variant="outline" onClick={handleRevert} disabled={!dirty || isSaving}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t("ui:jsonEditor.revert")}
        </Button>
        {disabledReason ? (
          <span className="text-xs text-muted-foreground">{disabledReason}</span>
        ) : dirty ? (
          <span className="text-xs text-muted-foreground">{t("ui:jsonEditor.unsaved")}</span>
        ) : null}
      </div>
    </div>
  )
}
