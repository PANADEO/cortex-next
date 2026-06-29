"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatPollFilesystem, useIntrastatSettings } from "@/lib/intrastat/hooks"
import { Badge, Button, Card, CardContent, DataCard, LoadingState, PageHeader } from "@cortex/ui"
import { FolderInput, Loader2, PlayCircle, Sparkles } from "lucide-react"
import { toast } from "sonner"

export default function IntrastatSettingsPage() {
  const settings = useIntrastatSettings()
  const pollFilesystem = useIntrastatPollFilesystem()

  const handlePoll = async () => {
    try {
      const result = await pollFilesystem.mutateAsync()
      toast.success(`Imported ${result.imported} batch(es)`)
    } catch (error) {
      toast.error(formatIntrastatError(error, "Filesystem poll failed"))
    }
  }

  if (settings.isLoading) return <LoadingState label="Loading Intrastat settings..." />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Intrastat Settings"
        description="Operational status for filesystem intake, worker processing, and Gemini extraction."
        actions={
          <Button
            size="sm"
            onClick={handlePoll}
            disabled={pollFilesystem.isPending || !settings.data?.filesystem_configured}
          >
            {pollFilesystem.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Poll folder
          </Button>
        }
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-3">
        <DataCard
          label="Filesystem"
          value={settings.data?.filesystem_configured ? "Ready" : "Missing folder"}
          description={settings.data?.intrastat_watch_dir ?? "Set INTRASTAT_WATCH_DIR"}
          icon={FolderInput}
          tone={settings.data?.filesystem_configured ? "success" : "warning"}
        />
        <DataCard
          label="Poll interval"
          value={`${settings.data?.filesystem_poll_interval_seconds ?? 10}s`}
          description="WNT/<batch> and WDT/<batch> folders"
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
              Filesystem intake expects `INTRASTAT_WATCH_DIR/WNT/&lt;batch&gt;` and
              `INTRASTAT_WATCH_DIR/WDT/&lt;batch&gt;` folders or ZIP files. XML intake is
              intentionally outside v1.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
