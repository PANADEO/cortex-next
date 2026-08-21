"use client"

import { formatIdpBasicError } from "@/lib/idp-basic/api"
import {
  useIdpBasicPollMail,
  useIdpBasicSettings,
  useIdpBasicUploadToFilesystem,
} from "@/lib/idp-basic/hooks"
import type { IdpBasicSettings } from "@/lib/idp-basic/types"
import { Badge, Button, Card, CardContent, DataCard, LoadingState, PageHeader } from "@cortex/ui"
import type { TFunction } from "i18next"
import { FolderInput, Inbox, Loader2, MailCheck, Sparkles, Upload } from "lucide-react"
import { useRef, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function IdpBasicSettingsPage() {
  const { t } = useTranslation("idp-basic")
  const settings = useIdpBasicSettings()
  const pollMail = useIdpBasicPollMail()
  const uploadToFilesystem = useIdpBasicUploadToFilesystem()
  const filesystemInputRef = useRef<HTMLInputElement>(null)
  const filesystemUploadEnabled = Boolean(
    settings.data?.filesystem_enabled && settings.data.filesystem_configured,
  )

  const handlePoll = async () => {
    try {
      const result = await pollMail.mutateAsync()
      toast.success(t("toast.imported", { count: result.imported }))
    } catch {
      toast.error(t("toast.pollFailed"))
    }
  }

  const handleFilesystemUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const uploaded = await uploadToFilesystem.mutateAsync(file)
      toast.success(t("toast.savedToWatchedFolder", { fileName: uploaded.file_name }))
    } catch (error) {
      toast.error(formatIdpBasicError(error, t("errors.filesystemUploadFailedFallback")))
    } finally {
      input.value = ""
    }
  }

  if (settings.isLoading) return <LoadingState label={t("settings.loading")} />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={filesystemInputRef}
              type="file"
              accept=".zip,.pdf,.jpg,.jpeg,.png,.csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFilesystemUpload}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => filesystemInputRef.current?.click()}
              disabled={!filesystemUploadEnabled || uploadToFilesystem.isPending}
            >
              {uploadToFilesystem.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {t("settings.uploadToFolder")}
            </Button>
            <Button
              size="sm"
              onClick={handlePoll}
              disabled={pollMail.isPending || !settings.data?.mailbox_configured}
            >
              {pollMail.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailCheck className="mr-2 h-4 w-4" />
              )}
              {t("actions.pollNow")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-4">
        <DataCard
          label={t("fields.mailbox")}
          value={t(settings.data?.mailbox_configured ? "intake.connected" : "intake.notConfigured")}
          description={settings.data?.imap_host ?? t("settings.imapHostNotConfigured")}
          icon={Inbox}
          tone={settings.data?.mailbox_configured ? "success" : "warning"}
        />
        <DataCard
          label={t("fields.pollInterval")}
          value={`${settings.data?.poll_interval_seconds ?? 60}s`}
          description={settings.data?.imap_mailbox ?? "INBOX"}
        />
        <DataCard
          label={t("fields.filesystem")}
          value={filesystemStatusValue(t, settings.data)}
          description={filesystemStatusDescription(t, settings.data)}
          icon={FolderInput}
          tone={filesystemStatusTone(settings.data)}
        />
        <DataCard
          label="Gemini"
          value={t(settings.data?.gemini_configured ? "intake.configured" : "intake.fallback")}
          description={settings.data?.gemini_model ?? t("settings.noModel")}
          icon={Sparkles}
          tone={settings.data?.gemini_configured ? "success" : "warning"}
        />

        <Card className="lg:col-span-4">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={settings.data?.worker_enabled ? "secondary" : "outline"}>
                {t(
                  settings.data?.worker_enabled
                    ? "settings.workerEnabled"
                    : "settings.workerDisabled",
                )}
              </Badge>
              <Badge variant={settings.data?.mailbox_enabled ? "secondary" : "outline"}>
                {t(
                  settings.data?.mailbox_enabled
                    ? "settings.mailPollingEnabled"
                    : "settings.mailPollingDisabled",
                )}
              </Badge>
              <Badge
                variant={
                  settings.data?.filesystem_enabled && settings.data?.filesystem_configured
                    ? "secondary"
                    : "outline"
                }
              >
                {t(
                  settings.data?.filesystem_enabled && settings.data?.filesystem_configured
                    ? "settings.filesystemWatching"
                    : "settings.filesystemDisabled",
                )}
              </Badge>
              <Badge variant={settings.data?.gemini_configured ? "secondary" : "outline"}>
                {t(
                  settings.data?.gemini_configured
                    ? "settings.geminiLive"
                    : "settings.geminiFallback",
                )}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.mvpNote")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function filesystemStatusValue(
  t: TFunction<"idp-basic">,
  settings: IdpBasicSettings | undefined,
): string {
  if (!settings) return t("intake.loading")
  if (!settings.filesystem_enabled) return t("intake.disabled")
  if (!settings.filesystem_watch_dir) return t("intake.missingEnv")
  if (!settings.filesystem_configured) return t("intake.missingFolder")
  return t("intake.watching")
}

function filesystemStatusDescription(
  t: TFunction<"idp-basic">,
  settings: IdpBasicSettings | undefined,
): string {
  if (!settings) return t("intake.loadingSettings")
  if (settings.filesystem_watch_dir) {
    return `${settings.filesystem_watch_dir} / ${settings.filesystem_poll_interval_seconds}s`
  }
  return t("intake.setWatchDir")
}

function filesystemStatusTone(
  settings: IdpBasicSettings | undefined,
): "default" | "success" | "warning" {
  if (!settings || !settings.filesystem_enabled) return "default"
  return settings.filesystem_configured ? "success" : "warning"
}
