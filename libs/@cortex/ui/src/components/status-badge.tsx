import type { PackageStatus } from "@cortex/types"
import { cn } from "@cortex/utils"
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  PlayCircle,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { HTMLAttributes } from "react"

interface StatusMeta {
  label: string
  icon: LucideIcon
  className: string
}

const STATUS_META: Record<PackageStatus, StatusMeta> = {
  imported: {
    label: "Imported",
    icon: CircleDashed,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
  imported_with_error: {
    label: "Import error",
    icon: AlertCircle,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  analysing: {
    label: "Analysing",
    icon: Loader2,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
  analysis_failed: {
    label: "Analysis failed",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  ready_for_verification: {
    label: "Ready",
    icon: PlayCircle,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  verification: {
    label: "In verification",
    icon: Loader2,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  verified: {
    label: "Verified",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
}

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: PackageStatus
  size?: "sm" | "md"
  showIcon?: boolean
}

export function StatusBadge({
  status,
  size = "sm",
  showIcon = false,
  className,
  ...rest
}: StatusBadgeProps) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  const spin = status === "analysing" || status === "verification"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] font-medium leading-tight",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        meta.className,
        className,
      )}
      {...rest}
    >
      {showIcon ? (
        <Icon className={cn("h-3 w-3", spin && "animate-spin")} />
      ) : null}
      {meta.label}
    </span>
  )
}
