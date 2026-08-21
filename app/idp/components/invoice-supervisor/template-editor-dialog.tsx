"use client"

import {
  useInvoiceSupervisorDeleteTemplate,
  useInvoiceSupervisorGenerateDraft,
  useInvoiceSupervisorSaveTemplate,
} from "@/lib/invoice-supervisor/hooks"
import type {
  InvoiceSupervisorChannel,
  InvoiceSupervisorEscalationStage,
  InvoiceSupervisorMessageTemplate,
} from "@/lib/invoice-supervisor/types"
import {
  INVOICE_SUPERVISOR_CHANNEL_LABEL_KEYS,
  INVOICE_SUPERVISOR_ESCALATION_STAGE_LABEL_KEYS,
  INVOICE_SUPERVISOR_TEMPLATE_VARIABLE_LABEL_KEYS,
} from "@/lib/invoice-supervisor/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Checkbox,
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
import { Sparkles, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  toneId: number
  toneName: string
  toneDescription: string
  channel: InvoiceSupervisorChannel
  stage: InvoiceSupervisorEscalationStage
  existingTemplate: InvoiceSupervisorMessageTemplate | null
}

// Preselected variables for a fresh draft — the most commonly referenced
// ones across escalation stages. User can still toggle any of them off/on.
const DEFAULT_VARIABLES = [
  "numer_faktury",
  "kwota_pozostala",
  "waluta",
  "termin_platnosci",
  "dni_po_terminie",
  "numer_konta",
]

export function InvoiceSupervisorTemplateEditorDialog({
  open,
  onOpenChange,
  toneId,
  toneName,
  toneDescription,
  channel,
  stage,
  existingTemplate,
}: Props) {
  const { t } = useTranslation(["invoice-supervisor", "common"])
  const [selectedVars, setSelectedVars] = useState<string[]>(DEFAULT_VARIABLES)
  const [extraHint, setExtraHint] = useState("")
  const [subject, setSubject] = useState(existingTemplate?.subject ?? "")
  const [body, setBody] = useState(existingTemplate?.body ?? "")
  const [showGenerator, setShowGenerator] = useState(!existingTemplate)

  const generateDraft = useInvoiceSupervisorGenerateDraft()
  const saveTemplate = useInvoiceSupervisorSaveTemplate()
  const deleteTemplate = useInvoiceSupervisorDeleteTemplate()

  function toggleVar(key: string, checked: boolean) {
    setSelectedVars((prev) => (checked ? [...prev, key] : prev.filter((v) => v !== key)))
  }

  function handleGenerate() {
    generateDraft.mutate(
      {
        tone_name: toneName,
        tone_description: toneDescription,
        channel,
        escalation_stage: stage,
        selected_variable_keys: selectedVars,
        ...(extraHint ? { extra_hint: extraHint } : {}),
      },
      {
        onSuccess: (draft) => {
          setSubject(draft.subject ?? "")
          setBody(draft.body)
        },
      },
    )
  }

  function handleSave() {
    saveTemplate.mutate(
      {
        tone_id: toneId,
        channel,
        escalation_stage: stage,
        body,
        subject: channel === "email" ? subject : null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  function handleDelete() {
    if (!existingTemplate) return
    deleteTemplate.mutate(existingTemplate.id, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {toneName} · {t(INVOICE_SUPERVISOR_CHANNEL_LABEL_KEYS[channel])} ·{" "}
            {t(INVOICE_SUPERVISOR_ESCALATION_STAGE_LABEL_KEYS[stage])}
          </DialogTitle>
          <DialogDescription>
            {existingTemplate
              ? t("templateEditor.descriptionExisting")
              : t("templateEditor.descriptionNew")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {existingTemplate && !showGenerator && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGenerator(true)}
            >
              <Sparkles className="size-4" />
              {t("templateEditor.regenerate")}
            </Button>
          )}

          {showGenerator && (
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <Label className="mb-2 block">{t("templateEditor.variablesLabel")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(INVOICE_SUPERVISOR_TEMPLATE_VARIABLE_LABEL_KEYS).map(
                    ([key, labelKey]) => (
                      <label key={key} className="flex min-w-0 items-start gap-2 text-sm">
                        <Checkbox
                          checked={selectedVars.includes(key)}
                          onCheckedChange={(c) => toggleVar(key, c === true)}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 break-words leading-snug">
                          <span>@{key}</span>{" "}
                          <span className="text-muted-foreground">({t(labelKey)})</span>
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t("templateEditor.extraHintLabel")}</Label>
                <Textarea
                  value={extraHint}
                  onChange={(e) => setExtraHint(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateDraft.isPending}
                variant="outline"
                className="w-full"
              >
                <Sparkles className="size-4" />
                {generateDraft.isPending
                  ? t("templateEditor.generating")
                  : t("templateEditor.generate")}
              </Button>
            </div>
          )}

          {(body || subject) && (
            <div className="space-y-3 rounded-lg border p-4">
              {channel === "email" && (
                <div className="space-y-1">
                  <Label>{t("templateEditor.subjectLabel")}</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label>{t("templateEditor.bodyLabel")}</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {existingTemplate ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={deleteTemplate.isPending}>
                  <Trash2 className="size-4" />
                  {t("templateEditor.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("templateEditor.deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("templateEditor.deleteDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t("common:actions.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={!body || saveTemplate.isPending}>
            {existingTemplate
              ? t("templateEditor.saveChanges")
              : t("templateEditor.saveAsTemplate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
