import type { TileMenuSection } from "@cortex/ui"
import {
  BarChart3,
  FileDown,
  FileSpreadsheet,
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
      { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/dashboard" },
      { id: "import", label: "Import", icon: Upload, href: "/import" },
      {
        id: "classification",
        label: "Classification",
        icon: FileSpreadsheet,
        href: "/classification",
      },
      { id: "packages", label: "Extraction", icon: Package, href: "/packages" },
      { id: "export", label: "Export", icon: FileDown, href: "/export" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { id: "rules", label: "Rule editor", icon: ScrollText, href: "/rules" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { id: "audit-log", label: "Audit log", icon: History, href: "/audit-log" },
    ],
  },
]
