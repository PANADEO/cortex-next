import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Skeleton } from "./ui/skeleton"

interface DataCardProps {
  label: string
  value: string | number
  description?: string
  icon?: LucideIcon
  isLoading?: boolean
  tone?: "default" | "success" | "warning" | "destructive" | "info"
  className?: string
}

const TONE_CLASSES: Record<NonNullable<DataCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
  info: "text-info",
}

export function DataCard({
  label,
  value,
  description,
  icon: Icon,
  isLoading,
  tone = "default",
  className,
}: DataCardProps) {
  return (
    <Card className={cn("transition-colors", className)}>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className={cn("text-2xl font-semibold tracking-tight", TONE_CLASSES[tone])}>
              {value}
            </p>
          )}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
