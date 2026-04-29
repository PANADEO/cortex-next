import type { TileMenuSection } from "@cortex/ui"
import {
  BarChart3,
  FileDown,
  History,
  Package,
  ScrollText,
  Upload,
} from "lucide-react"

export const IDP_NAV: TileMenuSection[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/idp/dashboard" },
      { id: "import", label: "Import", icon: Upload, href: "/idp/import" },
      { id: "packages", label: "Extraction", icon: Package, href: "/idp/packages" },
      { id: "export", label: "Export", icon: FileDown, href: "/idp/export" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { id: "rules", label: "Rule editor", icon: ScrollText, href: "/idp/rules" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { id: "audit-log", label: "Audit log", icon: History, href: "/idp/audit-log" },
    ],
  },
]
