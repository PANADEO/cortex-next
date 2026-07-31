import { useAuthorizedApps, useFeatureFlags, useFeatureFlagSettings } from "@cortex/api"
import type { FeatureFlagsResponse } from "@cortex/types"
import type { TileMenuItem, TileMenuSection } from "@cortex/ui"
import {
  BarChart3,
  Calculator,
  Database,
  FileDown,
  Files,
  FileSpreadsheet,
  FileText,
  Film,
  GitMerge,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Package,
  Receipt,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TableProperties,
  Upload,
  Users,
} from "lucide-react"
import { useMemo } from "react"
import { getVisibleAiTools } from "./ai-tools/registry"

export const IDP_NAV: TileMenuSection[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/idp/dashboard" },
      { id: "import", label: "Import", icon: Upload, href: "/idp/import" },
      { id: "packages", label: "Extraction", icon: Package, href: "/idp/packages" },
      {
        id: "export",
        label: "Export",
        icon: FileDown,
        href: "/idp/export",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "rules",
        label: "Rule editor",
        icon: ScrollText,
        href: "/idp/rules",
      },
      {
        id: "configuration",
        label: "Configuration",
        icon: Settings,
        href: "/idp/configuration",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [{ id: "audit-log", label: "Audit log", icon: History, href: "/idp/audit-log" }],
  },
]

export const IDP_BASIC_NAV: TileMenuSection[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/idp-basic/dashboard" },
      { id: "results", label: "Results", icon: Package, href: "/idp-basic/results" },
      {
        id: "files",
        label: "Files",
        icon: FileText,
        href: "/idp-basic/files",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        href: "/idp-basic/settings",
      },
    ],
  },
]

export const STORE_PIT_NAV: TileMenuSection[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "dashboard", label: "Overview", icon: LayoutDashboard, href: "/store-pit/dashboard" },
      { id: "source-files", label: "Source files", icon: Files, href: "/store-pit/source-files" },
      { id: "extraction", label: "Extraction", icon: Table2, href: "/store-pit/extraction" },
      {
        id: "reconciliation",
        label: "Reconciliation",
        icon: ListChecks,
        href: "/store-pit/reconciliation",
      },
      { id: "netting", label: "Netting", icon: GitMerge, href: "/store-pit/netting" },
      { id: "re-rating", label: "Re-rating", icon: Calculator, href: "/store-pit/re-rating" },
    ],
  },
  {
    id: "deliverables",
    label: "Deliverables",
    items: [{ id: "clients", label: "Clients", icon: Users, href: "/store-pit/clients" }],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "pricing",
        label: "Pricing rules",
        icon: SlidersHorizontal,
        href: "/store-pit/pricing",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [{ id: "audit-log", label: "Audit log", icon: History, href: "/store-pit/audit-log" }],
  },
]

export const OKNA_CZASOWE_NAV: TileMenuSection[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/okna-czasowe/dashboard",
      },
      { id: "films", label: "Filmy", icon: Film, href: "/okna-czasowe/films" },
      { id: "data", label: "Dane", icon: Database, href: "/okna-czasowe/data" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [{ id: "log", label: "Log", icon: History, href: "/okna-czasowe/log" }],
  },
]

export const SYSTEM_CONFIG_NAV: TileMenuSection[] = [
  {
    id: "dostep",
    label: "Dostęp",
    items: [
      {
        id: "uzytkownicy",
        label: "Użytkownicy",
        icon: Users,
        href: "/system-config/uzytkownicy",
      },
      { id: "role", label: "Role", icon: KeyRound, href: "/system-config/role" },
    ],
  },
  {
    id: "instancja",
    label: "Instancja",
    items: [
      {
        id: "aplikacje",
        label: "Aplikacje",
        icon: LayoutDashboard,
        href: "/system-config/aplikacje",
      },
    ],
  },
]

// Kafelek jednoekranowy — jedna pozycja, żeby powłoka `(main)` pokazała nazwę
// i sidebar tego kafelka zamiast dziedziczyć domyślną nawigację IDP.
// Id "dashboard", bo pathToItemId() w (main)/layout.tsx tak właśnie mapuje
// korzeń kafelka bez podstrony.
export const TOKEN_USAGE_NAV: TileMenuSection[] = [
  {
    id: "raport",
    label: "Raport",
    items: [
      { id: "dashboard", label: "Zużycie tokenów", icon: BarChart3, href: "/token-usage" },
    ],
  },
]

export const INTRASTAT_NAV: TileMenuSection[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/intrastat/dashboard" },
      { id: "batches", label: "Batches", icon: Package, href: "/intrastat/batches" },
      { id: "review", label: "Review", icon: TableProperties, href: "/intrastat/review" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "resources",
        label: "CN Code Database",
        icon: FileSpreadsheet,
        href: "/intrastat/resources",
      },
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        href: "/intrastat/settings",
      },
    ],
  },
]

export const ILUSTROMAT_NAV: TileMenuSection[] = [
  {
    id: "praca",
    label: "Praca",
    items: [
      { id: "generowanie", label: "Generowanie", icon: Sparkles, href: "/ilustromat/generowanie" },
      { id: "szablony", label: "Szablony", icon: FileText, href: "/ilustromat/szablony" },
    ],
  },
]

// cortex-cowork renders its own Codex-style shell (no TileMenu nav).

export const CORTEX_CONFIG_NAV: TileMenuSection[] = [
  {
    id: "governance",
    label: "Governance",
    items: [
      {
        id: "projects",
        label: "Projekty",
        icon: LayoutDashboard,
        href: "/cortex-config/projects",
      },
      {
        id: "catalog",
        label: "Katalog zasobów",
        icon: Database,
        href: "/cortex-config/catalog",
      },
      {
        id: "agents",
        label: "AGENTS.md",
        icon: FileText,
        href: "/cortex-config/agents",
      },
      {
        id: "roles",
        label: "Role i dostęp",
        icon: Users,
        href: "/cortex-config/governance",
      },
      {
        id: "credentials",
        label: "Sekrety",
        icon: KeyRound,
        href: "/cortex-config/credentials",
      },
    ],
  },
]

export const INVOICE_SUPERVISOR_NAV: TileMenuSection[] = [
  {
    id: "praca",
    label: "Praca",
    items: [
      { id: "inbox", label: "Skrzynka", icon: Inbox, href: "/invoice-supervisor/inbox" },
      { id: "invoices", label: "Faktury", icon: Receipt, href: "/invoice-supervisor/invoices" },
      { id: "clients", label: "Klienci", icon: Users, href: "/invoice-supervisor/clients" },
    ],
  },
  {
    id: "konfiguracja",
    label: "Konfiguracja",
    items: [
      { id: "policies", label: "Polityki", icon: ScrollText, href: "/invoice-supervisor/policies" },
      { id: "templates", label: "Szablony", icon: FileText, href: "/invoice-supervisor/templates" },
      { id: "settings", label: "Ustawienia", icon: Settings, href: "/invoice-supervisor/settings" },
    ],
  },
  {
    id: "audyt",
    label: "Audyt",
    items: [
      { id: "notifications", label: "Historia wysyłek", icon: History, href: "/invoice-supervisor/notifications" },
    ],
  },
]

export const AI_TOOLS_DASHBOARD_ITEM: TileMenuItem = {
  id: "dashboard",
  label: "Dashboard",
  icon: Sparkles,
  href: "/ai-tools",
}

function normalizeMenuKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[\s_]+/g, "-")
}

type HiddenMenuItemsConfig = FeatureFlagsResponse["hide_menu_items"]
const ADMIN_ITEM_IDS = new Set(["configuration"])

export function parseHiddenMenuItems(value: HiddenMenuItemsConfig): ReadonlySet<string> {
  const items = Array.isArray(value) ? value : (value ?? "").split(",")
  return new Set(items.map(normalizeMenuKey).filter(Boolean))
}

function itemKeys(item: TileMenuItem): string[] {
  const hrefLeaf = item.href.split("/").filter(Boolean).at(-1) ?? ""
  return [item.id, item.label, item.href, hrefLeaf].map(normalizeMenuKey)
}

export function filterNavSections(
  sections: readonly TileMenuSection[],
  hiddenItems: ReadonlySet<string>,
  options: { showAdminItems?: boolean } = {},
): TileMenuSection[] {
  const showAdminItems = options.showAdminItems ?? false
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (ADMIN_ITEM_IDS.has(item.id) && !showAdminItems) return false
        return !itemKeys(item).some((key) => hiddenItems.has(key))
      }),
    }))
    .filter((section) => section.items.length > 0)
}

export function useIdpNavSections(): TileMenuSection[] {
  const { data } = useFeatureFlags()
  const settings = useFeatureFlagSettings()
  const hiddenMenuItems = data?.hide_menu_items

  return useMemo(
    () =>
      filterNavSections(IDP_NAV, parseHiddenMenuItems(hiddenMenuItems), {
        showAdminItems: settings.isSuccess,
      }),
    [hiddenMenuItems, settings.isSuccess],
  )
}

export function useIdpBasicNavSections(): TileMenuSection[] {
  return IDP_BASIC_NAV
}

export function useStorePitNavSections(): TileMenuSection[] {
  return STORE_PIT_NAV
}

export function useOknaCzasoweNavSections(): TileMenuSection[] {
  return OKNA_CZASOWE_NAV
}

export function useIntrastatNavSections(): TileMenuSection[] {
  return INTRASTAT_NAV
}

export function useIlustromatNavSections(): TileMenuSection[] {
  return ILUSTROMAT_NAV
}

export function useSystemConfigNavSections(): TileMenuSection[] {
  return SYSTEM_CONFIG_NAV
}

export function useTokenUsageNavSections(): TileMenuSection[] {
  return TOKEN_USAGE_NAV
}

export function useInvoiceSupervisorNavSections(): TileMenuSection[] {
  return INVOICE_SUPERVISOR_NAV
}

export function useAiToolsNavSections(): TileMenuSection[] {
  const authorized = useAuthorizedApps()

  return useMemo(() => {
    const tools = getVisibleAiTools(authorized.apps)
    const grouped = tools.reduce<Record<string, TileMenuItem[]>>((acc, tool) => {
      const items = acc[tool.category] ?? []
      items.push({
        id: tool.id,
        label: tool.shortLabel,
        icon: tool.icon,
        href: `/ai-tools/${tool.id}`,
      })
      acc[tool.category] = items
      return acc
    }, {})

    return [
      {
        id: "home",
        label: "Start",
        items: [AI_TOOLS_DASHBOARD_ITEM],
      },
      ...Object.entries(grouped).map(([label, items]) => ({
        id: label.toLowerCase(),
        label,
        items,
      })),
    ]
  }, [authorized.apps])
}


export function useCortexConfigNavSections(): TileMenuSection[] {
  return CORTEX_CONFIG_NAV
}
