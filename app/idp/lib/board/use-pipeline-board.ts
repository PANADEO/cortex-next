"use client"

import { useDirtyPackages, useMe, usePackages } from "@cortex/api"
import { useDeferredValue, useMemo, useState } from "react"
import { UNASSIGNED, type OwnerSelection } from "@/components/board/owner-filter"
import {
  BOARD_COLUMNS,
  groupByStage,
  type BoardCard,
  type BoardColumns,
  type BoardStage,
} from "./pipeline"

export type KindFilter = "all" | "dirty" | "clean"

const BOARD_PAGE_SIZE = 100

export interface PipelineBoardState {
  search: string
  setSearch: (value: string) => void
  kindFilter: KindFilter
  setKindFilter: (value: KindFilter) => void
  ownerSelection: OwnerSelection
  setOwnerSelection: (value: OwnerSelection) => void
  currentUser: string | null
  knownOwners: readonly string[]
  columns: BoardColumns
  counts: Record<BoardStage, number>
  totalCount: number
  errorCount: number
  isLoading: boolean
}

export function usePipelineBoard(): PipelineBoardState {
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [ownerSelection, setOwnerSelection] = useState<OwnerSelection>("all")
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())

  const packages = usePackages({
    limit: BOARD_PAGE_SIZE,
    sort_by: "created_date",
    sort_order: "desc",
  })
  const dirty = useDirtyPackages({ limit: BOARD_PAGE_SIZE })
  const me = useMe()
  const currentUser = me.data?.email ?? null

  const rawColumns = useMemo<BoardColumns>(
    () => groupByStage(dirty.data?.items ?? [], packages.data?.items ?? []),
    [dirty.data?.items, packages.data?.items],
  )

  const knownOwners = useMemo(() => {
    const set = new Set<string>()
    for (const pkg of packages.data?.items ?? []) {
      if (pkg.assignee) set.add(pkg.assignee)
    }
    if (currentUser) set.add(currentUser)
    return [...set]
  }, [packages.data?.items, currentUser])

  const columns = useMemo<BoardColumns>(() => {
    const matchSearch = (card: BoardCard) => {
      if (!deferredSearch) return true
      const haystack = [card.title, card.id, card.subtitle].join(" ").toLowerCase()
      return haystack.includes(deferredSearch)
    }
    const matchKind = (card: BoardCard) => kindFilter === "all" || card.kind === kindFilter
    const matchOwner = (card: BoardCard) => {
      if (ownerSelection === "all") return true
      const key = card.kind === "clean" ? (card.assignee ?? UNASSIGNED) : UNASSIGNED
      return ownerSelection.has(key)
    }

    const next: BoardColumns = {
      intake: [],
      classified: [],
      processing: [],
      ready: [],
      verifying: [],
      done: [],
    }
    for (const stage of Object.keys(rawColumns) as BoardStage[]) {
      next[stage] = rawColumns[stage].filter(
        (c) => matchKind(c) && matchSearch(c) && matchOwner(c),
      )
    }
    return next
  }, [rawColumns, deferredSearch, kindFilter, ownerSelection])

  const counts = useMemo<Record<BoardStage, number>>(() => {
    const out = {} as Record<BoardStage, number>
    for (const meta of BOARD_COLUMNS) out[meta.id] = columns[meta.id].length
    return out
  }, [columns])

  const totalCount = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts],
  )

  const errorCount = useMemo(
    () =>
      columns.processing.filter((c) => c.kind === "clean" && c.hasError).length,
    [columns.processing],
  )

  return {
    search,
    setSearch,
    kindFilter,
    setKindFilter,
    ownerSelection,
    setOwnerSelection,
    currentUser,
    knownOwners,
    columns,
    counts,
    totalCount,
    errorCount,
    isLoading: packages.isLoading || dirty.isLoading,
  }
}
