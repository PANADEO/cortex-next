"use client"

import { cn } from "@cortex/utils"
import { Pause, Play, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

interface AutoRefreshIndicatorProps {
  intervalMs?: number
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onRefresh: () => void
  isRefreshing?: boolean
  className?: string
}

export function AutoRefreshIndicator({
  enabled,
  onToggle,
  onRefresh,
  isRefreshing,
  className,
}: AutoRefreshIndicatorProps) {
  const { t } = useTranslation("ui")
  const toggleLabel = enabled ? t("autoRefresh.pause") : t("autoRefresh.resume")
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-1 py-0.5",
          className,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onToggle(!enabled)}
              aria-label={toggleLabel}
            >
              {enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{toggleLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              aria-label={t("autoRefresh.refreshNow")}
            >
              <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("autoRefresh.refreshNow")}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
