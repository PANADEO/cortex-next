import { useFeatureFlags, useFeatureFlagSettings } from "@cortex/api"
import type { FeatureFlagsResponse } from "@cortex/types"
import type { TileMenuItem, TileMenuSection } from "@cortex/ui"
import {
  BarChart3,
  FileDown,
  FileText,
  History,
  Package,
  ScrollText,
  Settings,
  Upload,
} from "lucide-react"
import { useMemo } from "react"

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
