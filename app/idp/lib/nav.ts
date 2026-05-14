import type { TileMenuItem, TileMenuSection } from "@cortex/ui"
import { BarChart3, FileDown, History, Package, ScrollText, Upload } from "lucide-react"

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
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [{ id: "audit-log", label: "Audit log", icon: History, href: "/idp/audit-log" }],
  },
]

function normalizeMenuKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[\s_]+/g, "-")
}

export function parseHiddenMenuItems(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? "").split(",").map(normalizeMenuKey).filter(Boolean))
}

function itemKeys(item: TileMenuItem): string[] {
  const hrefLeaf = item.href.split("/").filter(Boolean).at(-1) ?? ""
  return [item.id, item.label, item.href, hrefLeaf].map(normalizeMenuKey)
}

export function filterNavSections(
  sections: readonly TileMenuSection[],
  hiddenItems: ReadonlySet<string>,
): TileMenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !itemKeys(item).some((key) => hiddenItems.has(key))),
    }))
    .filter((section) => section.items.length > 0)
}

export const IDP_NAV_SECTIONS = filterNavSections(
  IDP_NAV,
  parseHiddenMenuItems(process.env.NEXT_PUBLIC_HIDE_MENU_ITEMS),
)
