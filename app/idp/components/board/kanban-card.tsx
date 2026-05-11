"use client"

import { PackageStatusBadges } from "@cortex/ui"
import { cn, formatRelative, useFeatureFlag } from "@cortex/utils"
import { AlertTriangle, ArchiveRestore, Files, Flag, UserRound } from "lucide-react"
import Link from "next/link"
import type { BoardCard } from "@/lib/board/pipeline"

function initials(identifier: string): string {
  return (identifier[0] ?? "?").toUpperCase()
}

const KIND_STYLES: Record<BoardCard["kind"], string> = {
  dirty: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  clean: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
}

const KIND_LABEL: Record<BoardCard["kind"], string> = {
  dirty: "Dirty",
  clean: "Clean",
}

interface KanbanCardProps {
  card: BoardCard
}

export function KanbanCard({ card }: KanbanCardProps) {
  const classificationEnabled = useFeatureFlag("idp.classification")
  const assignee = card.kind === "clean" ? card.assignee : null
  return (
    <Link
      href={card.href}
      className={cn(
        "group relative block rounded-lg border border-border bg-card p-3 text-left shadow-sm transition",
        "hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {card.badgeId}
        </span>
        {classificationEnabled ? (
          <span
            className={cn(
              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              KIND_STYLES[card.kind],
            )}
          >
            {KIND_LABEL[card.kind]}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">
        {card.title}
      </p>

      {card.subtitle ? (
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
          {card.subtitle}
        </p>
      ) : null}

      <div className="mt-2.5">
        {card.kind === "clean" ? (
          <PackageStatusBadges
            processingState={card.processingState}
            verificationState={card.verificationState}
            size="xs"
            showIcon
          />
        ) : (
          <DirtyStatusRow card={card} />
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{formatRelative(card.createdDate)}</span>
        <div className="flex items-center gap-2">
          {card.kind === "dirty" && card.needsReviewCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <Flag className="h-3 w-3" />
              {card.needsReviewCount}
            </span>
          ) : null}
          {card.kind === "clean" && card.hasError ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-label="Processing error" />
          ) : null}
          {assignee ? (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-[9px] font-semibold text-muted-foreground"
              title={assignee}
            >
              {initials(assignee)}
            </span>
          ) : card.kind === "clean" ? (
            <UserRound className="h-3.5 w-3.5 opacity-40" aria-label="Unassigned" />
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function DirtyStatusRow({ card }: { card: Extract<BoardCard, { kind: "dirty" }> }) {
  const isPromoted = card.source.status === "promoted"
  const isArchived = card.source.status === "archived"
  const Icon = isPromoted || isArchived ? ArchiveRestore : Files

  const className = isPromoted
    ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
    : isArchived
      ? "bg-muted text-muted-foreground"
      : card.source.status === "classifying"
        ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
        : card.source.status === "classified"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"

  const label = card.source.status.replace(/_/g, " ")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium leading-tight",
        className,
      )}
    >
      <Icon className={cn("h-2.5 w-2.5", card.source.status === "classifying" && "animate-pulse")} />
      <span className="capitalize">{label}</span>
    </span>
  )
}
