"use client"

import { cn } from "@cortex/utils"
import { Pause, Play, RotateCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

interface AutoRefreshIndicatorProps {
  intervalMs?: number
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onRefresh: () => void
  isRefreshing?: boolean
  lastRefreshedAt?: Date | string | null
  className?: string
}

export function AutoRefreshIndicator({
  intervalMs = 5000,
  enabled,
  onToggle,
  onRefresh,
  isRefreshing,
  lastRefreshedAt,
  className,
}: AutoRefreshIndicatorProps) {
  const [countdown, setCountdown] = useState(intervalMs / 1000)

  useEffect(() => {
    if (!enabled) {
      setCountdown(intervalMs / 1000)
      return
    }
    setCountdown(intervalMs / 1000)
    const id = setInterval(() => {
      setCountdown((c) => (c <= 1 ? intervalMs / 1000 : c - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [enabled, intervalMs, lastRefreshedAt])

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs",
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
              aria-label={enabled ? "Pause auto-refresh" : "Resume auto-refresh"}
            >
              {enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {enabled ? "Pause auto-refresh" : "Resume auto-refresh"}
          </TooltipContent>
        </Tooltip>
        <span className="font-mono text-[10px] text-muted-foreground">
          {enabled ? `refresh in ${countdown}s` : "paused"}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              aria-label="Refresh now"
            >
              <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Refresh now</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
