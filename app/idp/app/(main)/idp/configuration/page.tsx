"use client"

import {
  ApiError,
  toastApiError,
  useFeatureFlagSettings,
  useReloadFeatureFlagSettingsFromEnv,
  useUpdateFeatureFlagSettings,
} from "@cortex/api"
import type { FeatureFlagSettingsResponse } from "@cortex/types"
import {
  Button,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Switch,
  Textarea,
} from "@cortex/ui"
import { Download, Loader2, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type BooleanFlagKey =
  | "enable_verification_process"
  | "package_custom_statuses"
  | "enable_user_notes"
  | "enable_po_number"
  | "enable_customs_code"
  | "enable_additional_ai_context"
  | "enable_atr_processing"
  | "enable_document_preview"
  | "enable_classification"

const BOOLEAN_FLAGS: ReadonlyArray<{
  key: BooleanFlagKey
  label: string
  env: string
}> = [
  {
    key: "enable_verification_process",
    label: "Verification process",
    env: "FEATURE_FLAG_ENABLE_VERIFICATION_PROCESS",
  },
  {
    key: "package_custom_statuses",
    label: "Package custom statuses",
    env: "FEATURE_FLAG_PACKAGE_CUSTOM_STATUSES",
  },
  {
    key: "enable_user_notes",
    label: "User notes",
    env: "FEATURE_FLAG_ENABLE_USER_NOTES",
  },
  {
    key: "enable_po_number",
    label: "PO number",
    env: "FEATURE_FLAG_ENABLE_PO_NUMBER",
  },
  {
    key: "enable_customs_code",
    label: "Customs code",
    env: "FEATURE_FLAG_ENABLE_CUSTOMS_CODE",
  },
  {
    key: "enable_additional_ai_context",
    label: "Additional AI context",
    env: "FEATURE_FLAG_ENABLE_ADDITIONAL_AI_CONTEXT",
  },
  {
    key: "enable_atr_processing",
    label: "A.TR processing",
    env: "FEATURE_FLAG_ENABLE_ATR_PROCESSING",
  },
  {
    key: "enable_document_preview",
    label: "Document preview",
    env: "FEATURE_FLAG_ENABLE_DOCUMENT_PREVIEW",
  },
  {
    key: "enable_classification",
    label: "Classification",
    env: "FEATURE_FLAG_ENABLE_CLASSIFICATION",
  },
]

function emptySettings(): FeatureFlagSettingsResponse {
  return {
    enable_verification_process: false,
    package_custom_statuses: false,
    enable_user_notes: false,
    enable_po_number: false,
    enable_customs_code: false,
    enable_additional_ai_context: false,
    enable_atr_processing: false,
    enable_document_preview: false,
    enable_classification: false,
    hide_menu_items: [],
    custom_statuses: [],
    export_templates: [],
    sad_context_defaults: "",
    smtp_host: null,
    smtp_port: 587,
    smtp_from_email: null,
    smtp_from_name: "Cortex IDP",
    smtp_use_tls: true,
    smtp_use_ssl: false,
    smtp_timeout_seconds: 10,
    gemini_model: "gemini-2.5-pro-preview-05-06",
    gemini_fast_model: null,
    gemini_temperature: null,
    gemini_fast_temperature: null,
    gemini_thinking_budget: null,
  }
}

function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function numberText(value: number | null): string {
  return value === null ? "" : String(value)
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalInteger(value: string): number | null {
  const parsed = parseOptionalNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}

export default function ConfigurationPage() {
  const query = useFeatureFlagSettings()
  const update = useUpdateFeatureFlagSettings()
  const reload = useReloadFeatureFlagSettingsFromEnv()
  const [form, setForm] = useState<FeatureFlagSettingsResponse>(() => emptySettings())
  const [hiddenMenuItemsText, setHiddenMenuItemsText] = useState("")
  const [customStatusesText, setCustomStatusesText] = useState("")
  const [exportTemplatesText, setExportTemplatesText] = useState("")
  const [geminiTemperatureText, setGeminiTemperatureText] = useState("")
  const [geminiFastTemperatureText, setGeminiFastTemperatureText] = useState("")
  const [geminiThinkingBudgetText, setGeminiThinkingBudgetText] = useState("")

  useEffect(() => {
    if (!query.data) return
    setForm(query.data)
    setHiddenMenuItemsText(query.data.hide_menu_items.join(", "))
    setCustomStatusesText(query.data.custom_statuses.join(", "))
    setExportTemplatesText(query.data.export_templates.join(", "))
    setGeminiTemperatureText(numberText(query.data.gemini_temperature))
    setGeminiFastTemperatureText(numberText(query.data.gemini_fast_temperature))
    setGeminiThinkingBudgetText(numberText(query.data.gemini_thinking_budget))
  }, [query.data])

  const payload = useMemo<FeatureFlagSettingsResponse>(
    () => ({
      ...form,
      hide_menu_items: parseCsvList(hiddenMenuItemsText),
      custom_statuses: parseCsvList(customStatusesText),
      export_templates: parseCsvList(exportTemplatesText),
      gemini_model: form.gemini_model.trim(),
      gemini_fast_model: form.gemini_fast_model?.trim() || null,
      gemini_temperature: parseOptionalNumber(geminiTemperatureText),
      gemini_fast_temperature: parseOptionalNumber(geminiFastTemperatureText),
      gemini_thinking_budget: parseOptionalInteger(geminiThinkingBudgetText),
    }),
    [
      customStatusesText,
      exportTemplatesText,
      form,
      geminiFastTemperatureText,
      geminiTemperatureText,
      geminiThinkingBudgetText,
      hiddenMenuItemsText,
    ],
  )

  const isBusy = update.isPending || reload.isPending
  const canSave = !isBusy && Boolean(form.gemini_model.trim())

  const onSave = () => {
    update.mutate(payload, {
      onSuccess: (settings) => {
        setForm(settings)
        setHiddenMenuItemsText(settings.hide_menu_items.join(", "))
        setCustomStatusesText(settings.custom_statuses.join(", "))
        setExportTemplatesText(settings.export_templates.join(", "))
        setGeminiTemperatureText(numberText(settings.gemini_temperature))
        setGeminiFastTemperatureText(numberText(settings.gemini_fast_temperature))
        setGeminiThinkingBudgetText(numberText(settings.gemini_thinking_budget))
        toast.success("Configuration saved.")
      },
      onError: (err) => toastApiError(err),
    })
  }

  const onReloadFromEnv = () => {
    reload.mutate(undefined, {
      onSuccess: (settings) => {
        setForm(settings)
        setHiddenMenuItemsText(settings.hide_menu_items.join(", "))
        setCustomStatusesText(settings.custom_statuses.join(", "))
        setExportTemplatesText(settings.export_templates.join(", "))
        setGeminiTemperatureText(numberText(settings.gemini_temperature))
        setGeminiFastTemperatureText(numberText(settings.gemini_fast_temperature))
        setGeminiThinkingBudgetText(numberText(settings.gemini_thinking_budget))
        toast.success("Configuration loaded from env.")
      },
      onError: (err) => toastApiError(err),
    })
  }

  let content = null
  if (query.isLoading) {
    content = <LoadingState label="Loading configuration" />
  } else if (query.isError) {
    content = (
      <ErrorState
        title={isForbidden(query.error) ? "Admin scope required" : "Configuration unavailable"}
        message={
          isForbidden(query.error)
            ? "Your account does not have the admin action scope."
            : "The feature flag configuration could not be loaded."
        }
        onRetry={() => query.refetch()}
      />
    )
  } else {
    content = (
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="grid grid-cols-[minmax(0,1fr)_120px] border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Flag</span>
            <span className="text-right">State</span>
          </div>
          <div className="divide-y divide-border">
            {BOOLEAN_FLAGS.map((flag) => (
              <div
                key={flag.key}
                className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <Label htmlFor={flag.key} className="text-sm font-medium">
                    {flag.label}
                  </Label>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {flag.env}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Switch
                    id={flag.key}
                    checked={form[flag.key]}
                    disabled={isBusy}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, [flag.key]: checked }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <Label htmlFor="hide-menu-items">Hidden menu items</Label>
            <Input
              id="hide-menu-items"
              value={hiddenMenuItemsText}
              disabled={isBusy}
              onChange={(event) => setHiddenMenuItemsText(event.target.value)}
              placeholder="export, rules"
              className="mt-2"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div>
              <Label htmlFor="custom-statuses">Custom statuses</Label>
              <Textarea
                id="custom-statuses"
                value={customStatusesText}
                disabled={isBusy}
                onChange={(event) => setCustomStatusesText(event.target.value)}
                placeholder="Accounting Department, Controling Department"
                className="mt-2 min-h-[84px]"
              />
            </div>
            <div>
              <Label htmlFor="export-templates">Export templates</Label>
              <Textarea
                id="export-templates"
                value={exportTemplatesText}
                disabled={isBusy}
                onChange={(event) => setExportTemplatesText(event.target.value)}
                placeholder="csv_new, standard_xml, sad_xml"
                className="mt-2 min-h-[84px]"
              />
            </div>
            <div>
              <Label htmlFor="sad-context-defaults">SAD context defaults</Label>
              <Textarea
                id="sad-context-defaults"
                value={form.sad_context_defaults}
                disabled={isBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sad_context_defaults: event.target.value,
                  }))
                }
                placeholder='{"header":{"decl_customs_off_no":"PL000000"}}'
                className="mt-2 min-h-[104px] font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Worker Gemini</h3>
            <div>
              <Label htmlFor="gemini-model">Model</Label>
              <Input
                id="gemini-model"
                value={form.gemini_model}
                disabled={isBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gemini_model: event.target.value,
                  }))
                }
                placeholder="gemini-2.5-pro-preview-05-06"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="gemini-fast-model">Fast model</Label>
              <Input
                id="gemini-fast-model"
                value={form.gemini_fast_model ?? ""}
                disabled={isBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gemini_fast_model: event.target.value,
                  }))
                }
                placeholder="gemini-2.5-flash"
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gemini-temperature">Temperature</Label>
                <Input
                  id="gemini-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.01}
                  value={geminiTemperatureText}
                  disabled={isBusy}
                  onChange={(event) => setGeminiTemperatureText(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="gemini-fast-temperature">Fast temperature</Label>
                <Input
                  id="gemini-fast-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.01}
                  value={geminiFastTemperatureText}
                  disabled={isBusy}
                  onChange={(event) =>
                    setGeminiFastTemperatureText(event.target.value)
                  }
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="gemini-thinking-budget">Thinking budget</Label>
              <Input
                id="gemini-thinking-budget"
                type="number"
                min={-1}
                step={1}
                value={geminiThinkingBudgetText}
                disabled={isBusy}
                onChange={(event) => setGeminiThinkingBudgetText(event.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div>
              <Label htmlFor="smtp-host">SMTP host</Label>
              <Input
                id="smtp-host"
                value={form.smtp_host ?? ""}
                disabled={isBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    smtp_host: event.target.value.trim() || null,
                  }))
                }
                placeholder="smtp.gmail.com"
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="smtp-port">SMTP port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.smtp_port}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      smtp_port: Number(event.target.value || 587),
                    }))
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="smtp-timeout">Timeout seconds</Label>
                <Input
                  id="smtp-timeout"
                  type="number"
                  min={1}
                  step={0.5}
                  value={form.smtp_timeout_seconds}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      smtp_timeout_seconds: Number(event.target.value || 10),
                    }))
                  }
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="smtp-from-email">From email</Label>
              <Input
                id="smtp-from-email"
                value={form.smtp_from_email ?? ""}
                disabled={isBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    smtp_from_email: event.target.value.trim() || null,
                  }))
                }
                placeholder="idp@example.com"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="smtp-from-name">From name</Label>
              <Input
                id="smtp-from-name"
                value={form.smtp_from_name}
                disabled={isBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    smtp_from_name: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                TLS
                <Switch
                  checked={form.smtp_use_tls}
                  disabled={isBusy}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, smtp_use_tls: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                SSL
                <Switch
                  checked={form.smtp_use_ssl}
                  disabled={isBusy}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, smtp_use_ssl: checked }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
            <Button type="button" onClick={onSave} disabled={!canSave}>
              {update.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onReloadFromEnv}
              disabled={isBusy}
            >
              {reload.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Load from env
            </Button>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Configuration"
        description="Runtime IDP settings stored in the database."
      />
      <div className="min-h-0 flex-1 px-8 py-6">{content}</div>
    </>
  )
}
