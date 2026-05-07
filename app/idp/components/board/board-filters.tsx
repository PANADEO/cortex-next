"use client"

import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Search } from "lucide-react"
import type { PipelineBoardState } from "@/lib/board/use-pipeline-board"
import { OwnerFilter } from "./owner-filter"

interface BoardFiltersProps {
  board: PipelineBoardState
  hideSearch?: boolean
  className?: string
}

export function BoardFilters({ board, hideSearch = false, className }: BoardFiltersProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {!hideSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={board.search}
            onChange={(e) => board.setSearch(e.target.value)}
            placeholder="Search by name, ID, customer…"
            className="h-9 w-72 pl-9"
          />
        </div>
      ) : null}

      <Select
        value={board.kindFilter}
        onValueChange={(v) => board.setKindFilter(v as typeof board.kindFilter)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All packages</SelectItem>
          <SelectItem value="dirty">Dirty only</SelectItem>
          <SelectItem value="clean">Clean only</SelectItem>
        </SelectContent>
      </Select>

      <OwnerFilter
        currentUser={board.currentUser}
        knownOwners={board.knownOwners}
        selection={board.ownerSelection}
        onChange={board.setOwnerSelection}
      />

      <div className="ml-auto text-xs text-muted-foreground">
        <span>{board.isLoading ? "Loading…" : `${board.totalCount} on board`}</span>
      </div>
    </div>
  )
}
