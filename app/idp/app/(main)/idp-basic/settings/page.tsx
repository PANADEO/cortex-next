"use client"

import { formatIdpBasicError } from "@/lib/idp-basic/api"
import {
  useIdpBasicPollMail,
  useIdpBasicSettings,
  useIdpBasicUploadToFilesystem,
} from "@/lib/idp-basic/hooks"
import type { IdpBasicSettings } from "@/lib/idp-basic/types"
import { Badge, Button, Card, CardContent, DataCard, LoadingState, PageHeader } from "@cortex/ui"
import { FolderInput, Inbox, Loader2, MailCheck, Sparkles, Upload } from "lucide-react"
import { useRef, type ChangeEvent } from "react"
import { toast } from "sonner"

export default function IdpBasicSettingsPage() {
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
      toast.success(`Imported ${result.imported} new package(s)`)
    } catch {
      toast.error("Mailbox poll failed")
    }
  }

  const handleFilesystemUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const uploaded = await uploadToFilesystem.mutateAsync(file)
      toast.success(`Saved ${uploaded.file_name} to watched folder`)
    } catch (error) {
      toast.error(formatIdpBasicError(error, "Filesystem upload failed"))
    } finally {
      input.value = ""
    }
  }

  if (settings.isLoading) return <LoadingState label="Loading settings…" />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="IDP Basic Settings"
        description="Operational status for mailbox, filesystem intake, and Gemini classification."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={filesystemInputRef}
              type="file"
              accept=".zip,.pdf,.jpg,.jpeg,.png"
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
              Upload to folder
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
              Poll now
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-4">
        <DataCard
          label="Mailbox"
          value={settings.data?.mailbox_configured ? "Connected" : "Missing env"}
          description={settings.data?.imap_host ?? "IMAP host not configured"}
          icon={Inbox}
          tone={settings.data?.mailbox_configured ? "success" : "warning"}
        />
        <DataCard
          label="Poll interval"
          value={`${settings.data?.poll_interval_seconds ?? 60}s`}
          description={settings.data?.imap_mailbox ?? "INBOX"}
        />
        <DataCard
          label="Filesystem"
          value={filesystemStatusValue(settings.data)}
          description={filesystemStatusDescription(settings.data)}
          icon={FolderInput}
          tone={filesystemStatusTone(settings.data)}
        />
        <DataCard
          label="Gemini"
          value={settings.data?.gemini_configured ? "Configured" : "Fallback"}
          description={settings.data?.gemini_model ?? "No model"}
          icon={Sparkles}
          tone={settings.data?.gemini_configured ? "success" : "warning"}
        />

        <Card className="lg:col-span-4">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={settings.data?.worker_enabled ? "secondary" : "outline"}>
                Worker {settings.data?.worker_enabled ? "enabled" : "disabled"}
              </Badge>
              <Badge variant={settings.data?.mailbox_enabled ? "secondary" : "outline"}>
                Mail polling {settings.data?.mailbox_enabled ? "enabled" : "disabled"}
              </Badge>
              <Badge
                variant={
                  settings.data?.filesystem_enabled && settings.data?.filesystem_configured
                    ? "secondary"
                    : "outline"
                }
              >
                Filesystem{" "}
                {settings.data?.filesystem_enabled && settings.data?.filesystem_configured
                  ? "watching"
                  : "disabled"}
              </Badge>
              <Badge variant={settings.data?.gemini_configured ? "secondary" : "outline"}>
                Gemini {settings.data?.gemini_configured ? "live" : "heuristic fallback"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              MVP imports unseen IMAP messages and local watched files, stores them as package
              documents, and processes packages one at a time. No outbound TMS or accounting
              integration is active.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function filesystemStatusValue(settings: IdpBasicSettings | undefined): string {
  if (!settings) return "Loading"
  if (!settings.filesystem_enabled) return "Disabled"
  if (!settings.filesystem_watch_dir) return "Missing env"
  if (!settings.filesystem_configured) return "Missing folder"
  return "Watching"
}

function filesystemStatusDescription(settings: IdpBasicSettings | undefined): string {
  if (!settings) return "Loading settings"
  if (settings.filesystem_watch_dir) {
    return `${settings.filesystem_watch_dir} / ${settings.filesystem_poll_interval_seconds}s`
  }
  return "Set FILESYSTEM_WATCH_DIR"
}

function filesystemStatusTone(
  settings: IdpBasicSettings | undefined,
): "default" | "success" | "warning" {
  if (!settings || !settings.filesystem_enabled) return "default"
  return settings.filesystem_configured ? "success" : "warning"
}
