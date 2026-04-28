import { ScanText } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type TileCategoryFunctional =
  | "content-generation"
  | "agents"
  | "research"
  | "misc"
  | "admin-system"

export type TileCategoryDepartment =
  | "operations"
  | "marketing"
  | "finance"
  | "it"
  | "hr"

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
  },
]
