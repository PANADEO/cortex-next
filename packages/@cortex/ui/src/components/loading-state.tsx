import { cn } from "@cortex/utils"
import { Loader2 } from "lucide-react"
import { Skeleton } from "./ui/skeleton"

interface LoadingStateProps {
  variant?: "spinner" | "skeleton"
  label?: string
  rows?: number
  className?: string
}

export function LoadingState({
  variant = "spinner",
  label,
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ? <span>{label}</span> : null}
    </div>
  )
}
