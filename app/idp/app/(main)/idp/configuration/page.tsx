"use client"

import {
  ApiError,
  toastApiError,
  useFeatureFlagSettings,
  useReloadFeatureFlagSettingsFromEnv,
  useUpdateFeatureFlagSettings,
} from "@cortex/api"
import type { FeatureFlagSettingsResponse, UpdateFeatureFlagSettingsRequest } from "@cortex/types"
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
  | "enable_imap_import"
  | "enable_import_email_notifications"

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
  {
    key: "enable_imap_import",
    label: "IMAP import",
    env: "FEATURE_FLAG_ENABLE_IMAP_IMPORT",
  },
  {
    key: "enable_import_email_notifications",
    label: "Import email notifications",
    env: "FEATURE_FLAG_ENABLE_IMPORT_EMAIL_NOTIFICATIONS",
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
    enable_imap_import: false,
    enable_import_email_notifications: true,
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
    imap_host: null,
    imap_port: 993,
    imap_secure: true,
    imap_user: null,
    imap_mailbox: "INBOX",
    imap_processed_mailbox: null,
    imap_drafts_mailbox: null,
    imap_poll_limit: 25,
    imap_password_configured: false,
    gemini_model: "gemini-2.5-pro",
    gemini_fast_model: "gemini-3.5-flash",
    gemini_temperature: 0.1,
    gemini_fast_temperature: 0.4,
    gemini_thinking_budget: 12000,
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
  const [imapPassword, setImapPassword] = useState("")

  useEffect(() => {
    if (!query.data) return
    setForm(query.data)
    setHiddenMenuItemsText(query.data.hide_menu_items.join(", "))
    setCustomStatusesText(query.data.custom_statuses.join(", "))
    setExportTemplatesText(query.data.export_templates.join(", "))
    setGeminiTemperatureText(numberText(query.data.gemini_temperature))
    setGeminiFastTemperatureText(numberText(query.data.gemini_fast_temperature))
    setGeminiThinkingBudgetText(numberText(query.data.gemini_thinking_budget))
    setImapPassword("")
  }, [query.data])

  const payload = useMemo<UpdateFeatureFlagSettingsRequest>(
    () => ({
      ...form,
      imap_password: imapPassword || null,
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
      imapPassword,
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
        setImapPassword("")
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
        setImapPassword("")
        toast.success("Configuration loaded from env.")
      },
      onError: (err) => toastApiError(err),
    })
  }

  const headerActions = query.isSuccess ? (
    <>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={!canSave}
        title="Save"
        className="h-8 w-8 px-0 sm:w-auto sm:px-3"
      >
        {update.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
        ) : (
          <Save className="h-4 w-4 sm:mr-1.5" />
        )}
        <span className="hidden sm:inline">Save</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onReloadFromEnv}
        disabled={isBusy}
        title="Load from env"
        className="h-8 w-8 px-0 sm:w-auto sm:px-3"
      >
        {reload.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
        ) : (
          <Download className="h-4 w-4 sm:mr-1.5" />
        )}
        <span className="hidden sm:inline">Load from env</span>
      </Button>
    </>
  ) : null

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
      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(360px,0.85fr)_minmax(520px,1.15fr)]">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="grid grid-cols-[minmax(0,1fr)_96px] border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Flag</span>
            <span className="text-right">State</span>
          </div>
          <div className="divide-y divide-border">
            {BOOLEAN_FLAGS.map((flag) => (
              <div
                key={flag.key}
                className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-3 py-2"
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

        <aside className="grid auto-rows-max gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border bg-background p-3">
            <div>
              <Label htmlFor="hide-menu-items">Hidden menu items</Label>
              <Input
                id="hide-menu-items"
                value={hiddenMenuItemsText}
                disabled={isBusy}
                onChange={(event) => setHiddenMenuItemsText(event.target.value)}
                placeholder="export, rules"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="custom-statuses">Custom statuses</Label>
              <Textarea
                id="custom-statuses"
                value={customStatusesText}
                disabled={isBusy}
                onChange={(event) => setCustomStatusesText(event.target.value)}
                placeholder="Accounting Department, Controling Department"
                className="mt-1.5 min-h-[48px]"
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
                className="mt-1.5 min-h-[48px]"
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
                className="mt-1.5 min-h-[56px] font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-background p-3">
            <h3 className="text-sm font-semibold">Worker Gemini</h3>
            <div className="grid grid-cols-2 gap-3">
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
                  placeholder="gemini-2.5-pro"
                  className="mt-1.5"
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
                  className="mt-1.5"
                />
              </div>
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
                  className="mt-1.5"
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
                  className="mt-1.5"
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
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-background p-3 lg:col-span-2">
            <h3 className="text-sm font-semibold">SMTP</h3>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_120px]">
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
                  className="mt-1.5"
                />
              </div>
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
                  className="mt-1.5"
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
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_96px]">
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
                  className="mt-1.5"
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
                  className="mt-1.5"
                />
              </div>
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

          <div className="space-y-2 rounded-lg border border-border bg-background p-3 lg:col-span-2">
            <h3 className="text-sm font-semibold">IMAP</h3>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_120px]">
              <div>
                <Label htmlFor="imap-host">IMAP host</Label>
                <Input
                  id="imap-host"
                  value={form.imap_host ?? ""}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_host: event.target.value.trim() || null,
                    }))
                  }
                  placeholder="imap.gmail.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="imap-port">IMAP port</Label>
                <Input
                  id="imap-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.imap_port}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_port: Number(event.target.value || 993),
                    }))
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="imap-poll-limit">Poll limit</Label>
                <Input
                  id="imap-poll-limit"
                  type="number"
                  min={1}
                  max={500}
                  value={form.imap_poll_limit}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_poll_limit: Number(event.target.value || 25),
                    }))
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px]">
              <div>
                <Label htmlFor="imap-user">IMAP user</Label>
                <Input
                  id="imap-user"
                  value={form.imap_user ?? ""}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_user: event.target.value.trim() || null,
                    }))
                  }
                  placeholder="mailbox@example.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="imap-password">
                  IMAP password{form.imap_password_configured ? " (configured)" : ""}
                </Label>
                <Input
                  id="imap-password"
                  type="password"
                  value={imapPassword}
                  disabled={isBusy}
                  onChange={(event) => setImapPassword(event.target.value)}
                  placeholder={form.imap_password_configured ? "Leave blank to keep" : ""}
                  className="mt-1.5"
                  autoComplete="new-password"
                />
              </div>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                Secure
                <Switch
                  checked={form.imap_secure}
                  disabled={isBusy}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, imap_secure: checked }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <Label htmlFor="imap-mailbox">Mailbox</Label>
                <Input
                  id="imap-mailbox"
                  value={form.imap_mailbox}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_mailbox: event.target.value,
                    }))
                  }
                  placeholder="INBOX"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="imap-processed-mailbox">Processed mailbox</Label>
                <Input
                  id="imap-processed-mailbox"
                  value={form.imap_processed_mailbox ?? ""}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_processed_mailbox: event.target.value.trim() || null,
                    }))
                  }
                  placeholder="[Gmail]/Processed"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="imap-drafts-mailbox">Drafts mailbox</Label>
                <Input
                  id="imap-drafts-mailbox"
                  value={form.imap_drafts_mailbox ?? ""}
                  disabled={isBusy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imap_drafts_mailbox: event.target.value.trim() || null,
                    }))
                  }
                  placeholder="[Gmail]/Drafts"
                  className="mt-1.5"
                />
              </div>
            </div>
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
        actions={headerActions}
      />
      <div className="min-h-0 flex-1 px-6 py-4">{content}</div>
    </>
  )
}
