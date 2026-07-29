import type { CoworkTileArchetype } from "@cortex/types"
import type { LucideIcon } from "lucide-react"
import { CalendarClock, FileSpreadsheet, FileText, Image, Receipt, ScanText, Settings, ShieldCheck, Users, Video, Workflow } from "lucide-react"
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
  /** Platform taxonomy (see docs/ROADMAP.md): what kind of thing this tile depicts. */
  archetype: CoworkTileArchetype
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
    archetype: "dashboard",
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

// Task-chat tiles are NOT listed here: they come from the cortex-config
// governance store and are merged into the hub grid at render time (see
// useCoworkProjectTiles). This array holds only code-backed tiles.
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
    archetype: "dashboard",
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
    archetype: "dashboard",
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
    archetype: "dashboard",
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
    archetype: "dashboard",
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
    archetype: "dashboard",
  },
  {
    id: "cortex-config",
    label: "Cortex Config",
    description:
      "Centralne governance platformy - projekty agentowe, role, grupy skilli i uprawnienia",
    href: "/cortex-config/projects",
    icon: ShieldCheck,
    iconBg: "bg-emerald-200 dark:bg-emerald-900/40",
    iconFg: "text-emerald-700 dark:text-emerald-300",
    categoryFunctional: "admin-system",
    categoryDepartment: ["it"],
    archetype: "agent-config",
  },
  {
    // Port funkcji cortex-admin. NIE mylić z "cortex-config" wyżej — tamto to
    // governance Cortex Cowork, to jest konfiguracja systemu (users/role/
    // uprawnienia/rejestr kafelków). Nazwy bliskie, byty różne.
    //
    // Wpis pozostaje w kodzie na czas P1: rejestr w bazie (tabela applications)
    // jest już źródłem prawdy dla UPRAWNIEŃ, ale pusty rejestr nie może wygasić
    // huba — pełne odcięcie tiles.ts dopiero po migracji danych.
    id: "system-config",
    label: "Konfiguracja Systemu",
    description: "Użytkownicy, role, uprawnienia i aplikacje instancji",
    // Ten sam adres co `route` wiersza `system-config` w tabeli applications —
    // rejestr i kod mają wskazywać dokładnie to samo miejsce.
    href: "/system-config",
    icon: Settings,
    iconBg: "bg-slate-200 dark:bg-slate-800/60",
    iconFg: "text-slate-700 dark:text-slate-300",
    categoryFunctional: "admin-system",
    categoryDepartment: ["it"],
    archetype: "dashboard",
  },
  {
    // Port kafelka z PoC (Python/Streamlit). Marka jest DANĄ w schemacie
    // "ilustromat" (szablony), nie stałą w kodzie.
    id: "ilustromat",
    label: "Ilustromat",
    description: "Brandowane ilustracje do postów LinkedIn — generacja i gotowa ramka",
    href: "/ilustromat/generowanie",
    icon: Image,
    iconBg: "bg-violet-200 dark:bg-violet-900/40",
    iconFg: "text-violet-700 dark:text-violet-300",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing"],
    archetype: "dashboard",
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
    archetype: "dashboard",
  },
  {
    // Świadomie link-only, nie natywny port — produkt już stabilny, osobna
    // rodzina serwisów (frontend na Vercel, backend na innej domenie,
    // whisper-service tylko przez VPN mesh), zero wspólnego Dockera do
    // wciągnięcia w docker-compose. Domena zweryfikowana w README repo
    // meeting-guru-frontend (Vercel, branch main -> chat.megu.me).
    id: "meeting-guru",
    label: "Nagrywanie Spotkań",
    description: "Asystent spotkań sprzedażowych — nagrywanie, transkrypcja i wskazówki AI na żywo",
    href: "https://chat.megu.me",
    external: true,
    icon: Video,
    iconBg: "bg-teal-200 dark:bg-teal-900/40",
    iconFg: "text-teal-700 dark:text-teal-300",
    categoryFunctional: "agents",
    categoryDepartment: ["operations"],
    archetype: "dashboard",
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
    archetype: "dashboard",
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
  const byId = TILES.find((tile) => rootSegments.includes(tile.id))
  if (byId) return byId.id
  // Some tiles (sp-console/sp-client) share one URL segment instead of putting
  // their id in the path. Only such tiles participate in the fallback - tiles
  // that embed their id in the href (ai-tools) must stay id-addressed, so an
  // unknown tool slug remains a deny. Exact href match wins, then the first
  // tile living under the segment owns its remaining subpages.
  const first = rootSegments[0]
  if (!first) return null
  const candidates = TILES.filter((tile) => {
    const segments = tile.href.split("/").filter(Boolean)
    return segments[0] === first && !segments.includes(tile.id)
  })
  const path = `/${rootSegments.join("/")}`
  return (candidates.find((tile) => tile.href === path) ?? candidates[0])?.id ?? null
}

export function canAccessTile(apps: readonly string[], tileId: string): boolean {
  if (isAiToolId(tileId)) {
    return canAccessAiTool(apps, tileId)
  }
  return apps.includes(tileId)
}
