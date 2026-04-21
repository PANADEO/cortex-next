import type { TileMenuSection } from "@cortex/ui"
import {
  BarChart3,
  FileSpreadsheet,
  History,
  Package,
  ScrollText,
  Upload,
} from "lucide-react"

export const IDP_NAV: TileMenuSection[] = [
  {
    id: "workspace",
    label: "IDP",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/dashboard" },
      { id: "import", label: "Import", icon: Upload, href: "/import" },
      {
        id: "classification",
        label: "Classification",
        icon: FileSpreadsheet,
        href: "/classification",
      },
      { id: "packages", label: "Packages", icon: Package, href: "/packages" },
      { id: "rules", label: "Rule editor", icon: ScrollText, href: "/rules" },
      { id: "audit-log", label: "Audit log", icon: History, href: "/audit-log" },
    ],
  },
]
