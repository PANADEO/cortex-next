"use client"

import type { PipelineBoardState } from "@/lib/board/use-pipeline-board"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { cn, useFeatureFlag } from "@cortex/utils"
import { Search, X } from "lucide-react"
import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { OwnerFilter } from "./owner-filter"

type SearchMode = "input" | "trigger" | "none"

interface BoardFiltersProps {
  board: PipelineBoardState
  searchMode?: SearchMode
  className?: string
}

export function BoardFilters({ board, searchMode = "input", className }: BoardFiltersProps) {
  const { t } = useTranslation("idp")
  const classificationEnabled = useFeatureFlag("idp.classification")
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {searchMode === "input" ? <SearchInput board={board} /> : null}
      {searchMode === "trigger" ? <SearchTrigger board={board} /> : null}

      {classificationEnabled ? (
        <Select
          value={board.kindFilter}
          onValueChange={(v) => board.setKindFilter(v as typeof board.kindFilter)}
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("board.filters.allPackages")}</SelectItem>
            <SelectItem value="dirty">{t("board.filters.dirtyOnly")}</SelectItem>
            <SelectItem value="clean">{t("board.filters.cleanOnly")}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <OwnerFilter
        currentUser={board.currentUser}
        knownOwners={board.knownOwners}
        selection={board.ownerSelection}
        onChange={board.setOwnerSelection}
      />

      <div className="ml-auto text-xs text-muted-foreground">
        <span>
          {board.isLoading
            ? t("board.filters.loading")
            : t("board.filters.onBoard", { n: board.totalCount })}
        </span>
      </div>
    </div>
  )
}

function SearchInput({ board }: { board: PipelineBoardState }) {
  const { t } = useTranslation("idp")
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={board.search}
        onChange={(e) => board.setSearch(e.target.value)}
        placeholder={t("board.search.placeholder")}
        className="h-9 w-72 pl-9"
      />
    </div>
  )
}

function SearchTrigger({ board }: { board: PipelineBoardState }) {
  const { t } = useTranslation("idp")
  const hasValue = board.search.length > 0
  const [expanded, setExpanded] = useState(hasValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    }
  }, [expanded])

  function handleBlur() {
    if (board.search.length === 0) {
      setExpanded(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.stopPropagation()
      board.setSearch("")
      setExpanded(false)
    }
  }

  function handleClear() {
    board.setSearch("")
    setExpanded(false)
  }

  if (expanded) {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={board.search}
          onChange={(e) => board.setSearch(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={t("board.search.placeholder")}
          className="h-9 w-72 pl-9 pr-9"
        />
        {hasValue ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("board.search.clear")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setExpanded(true)}
      aria-label={t("board.search.open")}
      className={cn("h-9 w-9", hasValue && "bg-accent text-accent-foreground")}
    >
      <Search className="h-4 w-4" />
    </Button>
  )
}
