"use client"

import {
  useInvoiceSupervisorRunSchedulerNow,
  useInvoiceSupervisorSchedulerConfig,
  useInvoiceSupervisorUpdateSchedulerConfig,
} from "@/lib/invoice-supervisor/hooks"
import type { InvoiceSupervisorSchedulerConfig } from "@/lib/invoice-supervisor/types"
import { formatInvoiceSupervisorDateTime } from "@/lib/invoice-supervisor/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Separator,
  Switch,
} from "@cortex/ui"
import { PlayCircle } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export default function InvoiceSupervisorSettingsPage() {
  const { t } = useTranslation("invoice-supervisor")
  const { data: config, isLoading } = useInvoiceSupervisorSchedulerConfig()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t("settings.title")} />

      <div className="px-8 py-6">
        {/* AI-002: always visible, not tucked behind a hover tooltip — this is
            the reassurance that the scheduler never sends anything itself. */}
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{t("settings.notice")}</p>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">{t("settings.scheduleCard")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading || !config ? (
              <LoadingState variant="skeleton" rows={4} />
            ) : (
              <SchedulerForm config={config} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Only mounted once `config` has actually loaded, so local state can be
// lazily initialized straight from it — no effect needed to "re-sync" state.
function SchedulerForm({ config }: { config: InvoiceSupervisorSchedulerConfig }) {
  const { t } = useTranslation("invoice-supervisor")
  const updateConfig = useInvoiceSupervisorUpdateSchedulerConfig()
  const runNow = useInvoiceSupervisorRunSchedulerNow()

  const [days, setDays] = useState<string[]>(config.days)
  const [hour, setHour] = useState(config.start_hour)
  const [minute, setMinute] = useState(config.start_minute)

  function toggleDay(day: string) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label>{t("settings.enabledLabel")}</Label>
          <p className="text-xs text-muted-foreground">
            {config.is_running ? t("settings.running") : t("settings.stopped")}
            {config.next_run_time &&
              ` · ${t("settings.nextRun", {
                time: formatInvoiceSupervisorDateTime(config.next_run_time),
              })}`}
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => updateConfig.mutate({ enabled })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("settings.daysLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {DAY_ORDER.map((day) => (
            <Badge
              key={day}
              variant={days.includes(day) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleDay(day)}
            >
              {t(`settings.days.${day}`)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{t("settings.hourLabel")}</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("settings.minuteLabel")}</Label>
          <Input
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
          />
        </div>
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button
          onClick={() => updateConfig.mutate({ days, start_hour: hour, start_minute: minute })}
          disabled={updateConfig.isPending}
        >
          {t("settings.saveSchedule")}
        </Button>
        <Button variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          <PlayCircle className="size-4" />
          {t("settings.runNow")}
        </Button>
      </div>
    </>
  )
}
