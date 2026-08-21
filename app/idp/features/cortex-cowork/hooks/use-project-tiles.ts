"use client"

import type { Tile } from "@/lib/tiles"
import { useQuery } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  Bot,
  FileSpreadsheet,
  FileText,
  MessagesSquare,
  Search,
  Sparkles,
  Table2,
} from "lucide-react"
import { useMemo } from "react"
import { coworkApi, coworkQueryKeys, type CoworkProjectTile } from "../queries"

// Governance config stores icons as names (data, not code); tiles render
// whatever this registry knows, defaulting to the chat icon. It is the ONE
// source for both the hub tiles and the project form's icon picker - add an
// icon here and it shows up in both. Extend deliberately - a giant registry
// would bloat the client bundle for no user value.
//
// The picker label lives in `projectEditor.icons.<value>` (namespace
// `cortex-config`); this registry carries identity and icon only.
export const PROJECT_ICON_OPTIONS: Array<{ value: string; icon: LucideIcon }> = [
  { value: "bot", icon: Bot },
  { value: "messages-square", icon: MessagesSquare },
  { value: "file-text", icon: FileText },
  { value: "file-spreadsheet", icon: FileSpreadsheet },
  { value: "search", icon: Search },
  { value: "sparkles", icon: Sparkles },
  { value: "table", icon: Table2 },
]

const PROJECT_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  PROJECT_ICON_OPTIONS.map((option) => [option.value, option.icon]),
)

function projectToTile(project: CoworkProjectTile): Tile {
  return {
    id: project.id,
    label: project.name,
    description: project.description,
    href: `/cortex-cowork/chat?project=${encodeURIComponent(project.id)}`,
    icon: PROJECT_ICONS[project.icon ?? ""] ?? MessagesSquare,
    iconBg: "bg-violet-200 dark:bg-violet-900/40",
    iconFg: "text-violet-700 dark:text-violet-300",
    categoryFunctional: "agents",
    categoryDepartment: ["it"],
    archetype: "task-chat",
  }
}

/**
 * Task-chat project tiles for the hub grid, resolved from the governance
 * store per user. Server-side visibility (role membership) already applied.
 */
export function useCoworkProjectTiles(): {
  tiles: Tile[]
  projects: CoworkProjectTile[]
  isLoading: boolean
} {
  const query = useQuery({
    queryKey: coworkQueryKeys.projects(),
    queryFn: coworkApi.listProjectTiles,
    staleTime: 30_000,
    retry: false,
  })
  const projects = useMemo(() => query.data ?? [], [query.data])
  const tiles = useMemo(() => projects.map(projectToTile), [projects])
  return { tiles, projects, isLoading: query.isPending }
}
