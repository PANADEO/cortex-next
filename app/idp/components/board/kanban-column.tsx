"use client"

import type { BoardCard, BoardColumnMeta } from "@/lib/board/pipeline"
import { cn } from "@cortex/utils"
import { Inbox } from "lucide-react"
import { KanbanCard } from "./kanban-card"

interface KanbanColumnProps {
  meta: BoardColumnMeta
  cards: readonly BoardCard[]
}

export function KanbanColumn({ meta, cards }: KanbanColumnProps) {
  return (
    <section
      className={cn(
        "relative flex h-full min-w-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted/30",
        "before:absolute before:inset-x-0 before:top-0 before:z-20 before:h-1 before:rounded-t-xl before:content-['']",
        meta.accent,
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl px-3 pb-2.5 pt-4",
          meta.headerBg,
        )}
      >
        <div className="min-w-0">
          <h2 className={cn("text-sm font-semibold leading-none", meta.headerText)}>
            {meta.label}
          </h2>
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{meta.description}</p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-semibold",
            meta.countBg,
          )}
        >
          {cards.length}
        </span>
      </header>

      {cards.length === 0 ? (
        <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-1 px-3 py-10 text-center text-xs text-muted-foreground">
          <Inbox className="h-4 w-4 opacity-50" />
          <span>No packages here</span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {cards.map((card) => (
            <KanbanCard key={`${card.kind}-${card.id}`} card={card} />
          ))}
        </div>
      )}
    </section>
  )
}
