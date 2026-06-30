import type { LucideIcon } from "lucide-react"
import { FileSpreadsheet, FileText, ScanText } from "lucide-react"
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
  ...AI_TOOL_DEFINITIONS.map(aiToolTile),
]
