import type { LucideIcon } from "lucide-react"
import { CalendarClock, FileSpreadsheet, FileText, Receipt, ScanText, Users, Workflow } from "lucide-react"
import { canAccessAiTool, isAiToolId } from "./ai-tools/app-codes"
import { AI_TOOL_DEFINITIONS, type AiToolDefinition } from "./ai-tools/registry"

export type TileCategoryFunctional =
  | "content-generation"
  | "agents"
  | "research"
  | "misc"
  | "admin-system"

export type TileCategoryDepartment = "operations" | "marketing" | "finance" | "it" | "hr"

export interface Tile {
  id: string
  label: string
  description: string
  href: string
  external?: boolean
  icon: LucideIcon
  iconBg: string
  iconFg: string
  categoryFunctional: TileCategoryFunctional
  categoryDepartment: TileCategoryDepartment[]
  versionEndpoint?: string
}

export type TileHrefOverrides = Partial<Record<string, string>>

const AI_TOOL_TILE_STYLE: Record<
  AiToolDefinition["category"],
  Pick<Tile, "categoryDepartment" | "categoryFunctional" | "iconBg" | "iconFg">
> = {
  Asystenci: {
    categoryFunctional: "agents",
    categoryDepartment: ["operations", "it"],
    iconBg: "bg-indigo-200 dark:bg-indigo-900/40",
    iconFg: "text-indigo-700 dark:text-indigo-300",
  },
  Dokumenty: {
    categoryFunctional: "misc",
    categoryDepartment: ["finance", "operations"],
    iconBg: "bg-amber-200 dark:bg-amber-900/40",
    iconFg: "text-amber-700 dark:text-amber-300",
  },
  Tekst: {
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "operations", "it"],
    iconBg: "bg-blue-200 dark:bg-blue-900/40",
    iconFg: "text-blue-700 dark:text-blue-300",
  },
  Treści: {
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "hr", "operations"],
    iconBg: "bg-violet-200 dark:bg-violet-900/40",
    iconFg: "text-violet-700 dark:text-violet-300",
  },
}

function aiToolTile(tool: AiToolDefinition): Tile {
  return {
    id: tool.id,
    label: tool.label,
    description: tool.description,
    href: `/ai-tools/${tool.id}`,
    icon: tool.icon,
    ...AI_TOOL_TILE_STYLE[tool.category],
  }
}

export const FUNCTIONAL_CATEGORIES: ReadonlyArray<{
  id: TileCategoryFunctional
  label: string
}> = [
  { id: "content-generation", label: "Generowanie treści" },
  { id: "agents", label: "Agenci" },
  { id: "research", label: "Badania" },
  { id: "misc", label: "Różne" },
  { id: "admin-system", label: "Admin & System" },
]

export const DEPARTMENT_CATEGORIES: ReadonlyArray<{
  id: TileCategoryDepartment
  label: string
}> = [
  { id: "operations", label: "Operacje" },
  { id: "marketing", label: "Marketing" },
  { id: "finance", label: "Finanse" },
  { id: "it", label: "IT" },
  { id: "hr", label: "HR" },
]

export const TILES: ReadonlyArray<Tile> = [
  {
    id: "idp",
    label: "IDP",
    description: "Procesowanie i ekstrakcja danych z dokumentów handlowych",
    href: "/idp/dashboard",
    icon: ScanText,
    iconBg: "bg-rose-200 dark:bg-rose-900/40",
    iconFg: "text-rose-700 dark:text-rose-300",
    categoryFunctional: "misc",
    categoryDepartment: ["operations"],
    versionEndpoint: "/idp/version",
  },
  {
    id: "idp-basic",
    label: "IDP Basic",
    description: "Uproszczone procesowanie dokumentów w osobnym pipeline",
    href: "/idp-basic/dashboard",
    icon: FileText,
    iconBg: "bg-sky-200 dark:bg-sky-900/40",
    iconFg: "text-sky-700 dark:text-sky-300",
    categoryFunctional: "misc",
    categoryDepartment: ["operations"],
    versionEndpoint: "/idp-basic/version",
  },
  {
    id: "sp-console",
    label: "Store-Pit Re-Rating",
    description: "Carrier invoice re-rating engine - GLS DE line detail to per-client settlement",
    href: "/store-pit/dashboard",
    icon: Workflow,
    iconBg: "bg-cyan-200 dark:bg-cyan-900/40",
    iconFg: "text-cyan-700 dark:text-cyan-300",
    categoryFunctional: "agents",
    categoryDepartment: ["finance", "operations"],
  },
  {
    id: "sp-client",
    label: "Store-Pit Client Zone",
    description: "Brand-facing view - each client sees its parcels and the amount to settle",
    href: "/store-pit/clients",
    icon: Users,
    iconBg: "bg-indigo-200 dark:bg-indigo-900/40",
    iconFg: "text-indigo-700 dark:text-indigo-300",
    categoryFunctional: "misc",
    categoryDepartment: ["finance"],
  },
  {
    id: "okna-czasowe",
    label: "Okna czasowe",
    description: "Śledzenie od kiedy filmy trafiają na Rakuten TV PL - codzienne skany JustWatch",
    href: "/okna-czasowe/dashboard",
    icon: CalendarClock,
    iconBg: "bg-amber-200 dark:bg-amber-900/40",
    iconFg: "text-amber-700 dark:text-amber-300",
    categoryFunctional: "research",
    categoryDepartment: ["marketing"],
  },
  {
    id: "intrastat",
    label: "Intrastat",
    description: "Przygotowanie importowych Exceli WNT/WDT z faktur",
    href: "/intrastat/dashboard",
    icon: FileSpreadsheet,
    iconBg: "bg-emerald-200 dark:bg-emerald-900/40",
    iconFg: "text-emerald-700 dark:text-emerald-300",
    categoryFunctional: "misc",
    categoryDepartment: ["operations", "finance"],
    versionEndpoint: "/intrastat/version",
  },
  {
    // id must equal backend-next's settings.application_name ("invoice-supervisor")
    // — cortex-admin's authorized-apps check keys off this exact string.
    id: "invoice-supervisor",
    label: "Nadzorca Faktur",
    description: "Nadzoruje terminy faktur i generuje AI przypomnienia płatnicze",
    href: "/invoice-supervisor/inbox",
    icon: Receipt,
    iconBg: "bg-orange-200 dark:bg-orange-900/40",
    iconFg: "text-orange-700 dark:text-orange-300",
    categoryFunctional: "misc",
    categoryDepartment: ["finance", "operations"],
    versionEndpoint: "/invoice-supervisor/version",
  },
  ...AI_TOOL_DEFINITIONS.map(aiToolTile),
]

/**
 * Resolves which tile a pathname belongs to, for authorization purposes.
 * Returns `null` when unresolvable — callers must treat that as deny, never
 * as "no requirement" (there is no tile-agnostic page under `(main)`).
 */
export function resolveRequiredTileId(pathname: string): string | null {
  const rootSegments = pathname.split("/").filter(Boolean).slice(0, 2)
  return TILES.find((tile) => rootSegments.includes(tile.id))?.id ?? null
}

export function canAccessTile(apps: readonly string[], tileId: string): boolean {
  if (isAiToolId(tileId)) {
    return canAccessAiTool(apps, tileId)
  }
  return apps.includes(tileId)
}
