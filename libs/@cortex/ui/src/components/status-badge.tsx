import type { ProcessingState, VerificationState } from "@cortex/types"
import { cn } from "@cortex/utils"
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Loader2,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { HTMLAttributes } from "react"

interface BadgeMeta {
  label: string
  icon: LucideIcon
  className: string
}

const PROCESSING_META: Record<ProcessingState, BadgeMeta> = {
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
  ready: {
    label: "Ready",
    icon: PlayCircle,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
}

const VERIFICATION_META: Record<VerificationState, BadgeMeta> = {
  not_started: {
    label: "Not started",
    icon: PauseCircle,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In verification",
    icon: Loader2,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  completed: {
    label: "Verified",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
}

export function getProcessingStateLabel(state: ProcessingState): string {
  return PROCESSING_META[state].label
}

export function getVerificationStateLabel(state: VerificationState): string {
  return VERIFICATION_META[state].label
}

type BadgeSize = "sm" | "md"

interface BaseBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  size?: BadgeSize
  showIcon?: boolean
}

function renderBadge(
  meta: BadgeMeta,
  spin: boolean,
  { size = "sm", showIcon = false, className, ...rest }: BaseBadgeProps,
) {
  const Icon = meta.icon
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

interface ProcessingStateBadgeProps extends BaseBadgeProps {
  state: ProcessingState
}

export function ProcessingStateBadge({ state, ...rest }: ProcessingStateBadgeProps) {
  return renderBadge(PROCESSING_META[state], state === "analysing", rest)
}

interface VerificationStateBadgeProps extends BaseBadgeProps {
  state: VerificationState
}

export function VerificationStateBadge({ state, ...rest }: VerificationStateBadgeProps) {
  return renderBadge(VERIFICATION_META[state], state === "in_progress", rest)
}

interface PackageStatusBadgesProps {
  processingState: ProcessingState
  verificationState: VerificationState
  size?: BadgeSize
  showIcon?: boolean
  className?: string
}

export function PackageStatusBadges({
  processingState,
  verificationState,
  size = "sm",
  showIcon = false,
  className,
}: PackageStatusBadgesProps) {
  const showVerification = processingState === "ready"
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <ProcessingStateBadge state={processingState} size={size} showIcon={showIcon} />
      {showVerification ? (
        <>
          <CircleDot className="h-2.5 w-2.5 text-muted-foreground/40" aria-hidden />
          <VerificationStateBadge state={verificationState} size={size} showIcon={showIcon} />
        </>
      ) : null}
    </span>
  )
}
