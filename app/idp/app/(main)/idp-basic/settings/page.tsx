"use client"

import { useIdpBasicPollMail, useIdpBasicSettings } from "@/lib/idp-basic/hooks"
import { Badge, Button, Card, CardContent, DataCard, LoadingState, PageHeader } from "@cortex/ui"
import { Inbox, Loader2, MailCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"

export default function IdpBasicSettingsPage() {
  const settings = useIdpBasicSettings()
  const pollMail = useIdpBasicPollMail()

  const handlePoll = async () => {
    try {
      const result = await pollMail.mutateAsync()
      toast.success(`Imported ${result.imported} new package(s)`)
    } catch {
      toast.error("Mailbox poll failed")
    }
  }

  if (settings.isLoading) return <LoadingState label="Loading settings…" />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="IDP Basic Settings"
        description="Operational status for mailbox intake and Gemini classification."
        actions={
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
        }
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-3">
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
          label="Gemini"
          value={settings.data?.gemini_configured ? "Configured" : "Fallback"}
          description={settings.data?.gemini_model ?? "No model"}
          icon={Sparkles}
          tone={settings.data?.gemini_configured ? "success" : "warning"}
        />

        <Card className="lg:col-span-3">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={settings.data?.worker_enabled ? "secondary" : "outline"}>
                Worker {settings.data?.worker_enabled ? "enabled" : "disabled"}
              </Badge>
              <Badge variant={settings.data?.mailbox_enabled ? "secondary" : "outline"}>
                Mail polling {settings.data?.mailbox_enabled ? "enabled" : "disabled"}
              </Badge>
              <Badge variant={settings.data?.gemini_configured ? "secondary" : "outline"}>
                Gemini {settings.data?.gemini_configured ? "live" : "heuristic fallback"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              MVP imports unseen IMAP messages, stores attachments as package documents, and
              processes packages one at a time. No outbound TMS or accounting integration is active.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
