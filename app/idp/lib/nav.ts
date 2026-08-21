import { useAuthorizedApps, useFeatureFlags, useFeatureFlagSettings } from "@cortex/api"
import type { FeatureFlagsResponse } from "@cortex/types"
import type { TileMenuItem, TileMenuSection } from "@cortex/ui"
import {
  BarChart3,
  Building2,
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
  LineChart,
  ListChecks,
  Package,
  Palette,
  Receipt,
  RefreshCw,
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
import { useTranslation } from "react-i18next"
import { getVisibleAiTools } from "./ai-tools/registry"
import { aiToolShortLabel } from "./i18n/ai-tool-names"

/**
 * Pozycja menu bocznego w postaci, w jakiej stoi w kodzie: z KLUCZEM
 * tłumaczenia zamiast napisu — stąd `labelKey`, nie `label`.
 *
 * Te same stałe karmią trzy miejsca naraz: sidebar (`TileMenu`), paletę
 * poleceń i breadcrumb. Napis wpisany tutaj byłby polski we wszystkich trzech
 * niezależnie od wybranego języka, bo stała powstaje raz, przy imporcie
 * modułu — zanim w ogóle wiadomo, jaki język wybrał użytkownik. `t()` woła
 * miejsce renderu (`translateNavSections` niżej).
 */
export interface NavItem extends Omit<TileMenuItem, "label"> {
  labelKey: string
}

export interface NavSection extends Omit<TileMenuSection, "label" | "items"> {
  labelKey?: string
  items: NavItem[]
}

export const IDP_NAV: NavSection[] = [
  {
    id: "pipeline",
    labelKey: "nav.sections.pipeline",
    items: [
      { id: "dashboard", labelKey: "nav.idp.dashboard", icon: BarChart3, href: "/idp/dashboard" },
      { id: "import", labelKey: "nav.idp.import", icon: Upload, href: "/idp/import" },
      { id: "packages", labelKey: "nav.idp.extraction", icon: Package, href: "/idp/packages" },
      {
        id: "export",
        labelKey: "nav.idp.export",
        icon: FileDown,
        href: "/idp/export",
      },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.sections.settings",
    items: [
      {
        id: "rules",
        labelKey: "nav.idp.rule-editor",
        icon: ScrollText,
        href: "/idp/rules",
      },
      {
        id: "configuration",
        labelKey: "nav.idp.configuration",
        icon: Settings,
        href: "/idp/configuration",
      },
    ],
  },
  {
    id: "reports",
    labelKey: "nav.sections.reports",
    items: [
      { id: "audit-log", labelKey: "nav.idp.audit-log", icon: History, href: "/idp/audit-log" },
    ],
  },
]

export const IDP_BASIC_NAV: NavSection[] = [
  {
    id: "pipeline",
    labelKey: "nav.sections.pipeline",
    items: [
      {
        id: "dashboard",
        labelKey: "nav.idpBasic.dashboard",
        icon: BarChart3,
        href: "/idp-basic/dashboard",
      },
      {
        id: "results",
        labelKey: "nav.idpBasic.results",
        icon: Package,
        href: "/idp-basic/results",
      },
      {
        id: "files",
        labelKey: "nav.idpBasic.files",
        icon: FileText,
        href: "/idp-basic/files",
      },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.sections.settings",
    items: [
      {
        id: "settings",
        labelKey: "nav.idpBasic.settings",
        icon: Settings,
        href: "/idp-basic/settings",
      },
    ],
  },
]

export const STORE_PIT_NAV: NavSection[] = [
  {
    id: "pipeline",
    labelKey: "nav.sections.pipeline",
    items: [
      {
        id: "dashboard",
        labelKey: "nav.storePit.overview",
        icon: LayoutDashboard,
        href: "/store-pit/dashboard",
      },
      {
        id: "source-files",
        labelKey: "nav.storePit.source-files",
        icon: Files,
        href: "/store-pit/source-files",
      },
      {
        id: "extraction",
        labelKey: "nav.storePit.extraction",
        icon: Table2,
        href: "/store-pit/extraction",
      },
      {
        id: "reconciliation",
        labelKey: "nav.storePit.reconciliation",
        icon: ListChecks,
        href: "/store-pit/reconciliation",
      },
      {
        id: "netting",
        labelKey: "nav.storePit.netting",
        icon: GitMerge,
        href: "/store-pit/netting",
      },
      {
        id: "re-rating",
        labelKey: "nav.storePit.re-rating",
        icon: Calculator,
        href: "/store-pit/re-rating",
      },
    ],
  },
  {
    id: "deliverables",
    labelKey: "nav.sections.deliverables",
    items: [
      { id: "clients", labelKey: "nav.storePit.clients", icon: Users, href: "/store-pit/clients" },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.sections.settings",
    items: [
      {
        id: "pricing",
        labelKey: "nav.storePit.pricing-rules",
        icon: SlidersHorizontal,
        href: "/store-pit/pricing",
      },
    ],
  },
  {
    id: "reports",
    labelKey: "nav.sections.reports",
    items: [
      {
        id: "audit-log",
        labelKey: "nav.storePit.audit-log",
        icon: History,
        href: "/store-pit/audit-log",
      },
    ],
  },
]

export const OKNA_CZASOWE_NAV: NavSection[] = [
  {
    id: "pipeline",
    labelKey: "nav.sections.pipeline",
    items: [
      {
        id: "dashboard",
        labelKey: "nav.oknaCzasowe.dashboard",
        icon: LayoutDashboard,
        href: "/okna-czasowe/dashboard",
      },
      { id: "films", labelKey: "nav.oknaCzasowe.films", icon: Film, href: "/okna-czasowe/films" },
      { id: "data", labelKey: "nav.oknaCzasowe.data", icon: Database, href: "/okna-czasowe/data" },
    ],
  },
  {
    id: "reports",
    labelKey: "nav.sections.reports",
    items: [
      { id: "log", labelKey: "nav.oknaCzasowe.log", icon: History, href: "/okna-czasowe/log" },
    ],
  },
]

export const SYSTEM_CONFIG_NAV: NavSection[] = [
  {
    id: "dostep",
    labelKey: "nav.sections.access",
    items: [
      {
        id: "users",
        labelKey: "nav.systemConfig.users",
        icon: Users,
        href: "/system-config/users",
      },
      {
        id: "role",
        labelKey: "nav.systemConfig.roles",
        icon: KeyRound,
        href: "/system-config/role",
      },
      {
        id: "openwebui",
        labelKey: "nav.systemConfig.openwebui",
        icon: RefreshCw,
        href: "/system-config/openwebui",
      },
    ],
  },
  {
    id: "instancja",
    labelKey: "nav.sections.instance",
    items: [
      {
        id: "applications",
        labelKey: "nav.systemConfig.applications",
        icon: LayoutDashboard,
        href: "/system-config/applications",
      },
      {
        id: "appearance",
        labelKey: "nav.systemConfig.appearance",
        icon: Palette,
        href: "/system-config/appearance",
      },
    ],
  },
]

// Kafelek jednoekranowy — jedna pozycja, żeby powłoka `(main)` pokazała nazwę
// i sidebar tego kafelka zamiast dziedziczyć domyślną nawigację IDP.
// Id "dashboard", bo pathToItemId() w (main)/layout.tsx tak właśnie mapuje
// korzeń kafelka bez podstrony.
export const TOKEN_USAGE_NAV: NavSection[] = [
  {
    id: "raport",
    labelKey: "nav.sections.report",
    items: [
      { id: "dashboard", labelKey: "nav.tokenUsage.usage", icon: BarChart3, href: "/token-usage" },
    ],
  },
]

export const INTRASTAT_NAV: NavSection[] = [
  {
    id: "pipeline",
    labelKey: "nav.sections.pipeline",
    items: [
      {
        id: "dashboard",
        labelKey: "nav.intrastat.dashboard",
        icon: BarChart3,
        href: "/intrastat/dashboard",
      },
      {
        id: "batches",
        labelKey: "nav.intrastat.batches",
        icon: Package,
        href: "/intrastat/batches",
      },
      {
        id: "review",
        labelKey: "nav.intrastat.review",
        icon: TableProperties,
        href: "/intrastat/review",
      },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.sections.settings",
    items: [
      {
        id: "resources",
        labelKey: "nav.intrastat.cn-code-database",
        icon: FileSpreadsheet,
        href: "/intrastat/resources",
      },
      {
        id: "settings",
        labelKey: "nav.intrastat.settings",
        icon: Settings,
        href: "/intrastat/settings",
      },
    ],
  },
]

export const ILUSTROMAT_NAV: NavSection[] = [
  {
    id: "praca",
    labelKey: "nav.sections.work",
    items: [
      {
        id: "generation",
        labelKey: "nav.ilustromat.generation",
        icon: Sparkles,
        href: "/ilustromat/generation",
      },
      {
        id: "templates",
        labelKey: "nav.ilustromat.templates",
        icon: FileText,
        href: "/ilustromat/templates",
      },
    ],
  },
]

// cortex-cowork renders its own Codex-style shell (no TileMenu nav).

export const CORTEX_CONFIG_NAV: NavSection[] = [
  {
    id: "governance",
    labelKey: "nav.sections.governance",
    items: [
      {
        id: "projects",
        labelKey: "nav.cortexConfig.projects",
        icon: LayoutDashboard,
        href: "/cortex-config/projects",
      },
      {
        id: "catalog",
        labelKey: "nav.cortexConfig.catalog",
        icon: Database,
        href: "/cortex-config/catalog",
      },
      {
        id: "agents",
        labelKey: "nav.cortexConfig.agents",
        icon: FileText,
        href: "/cortex-config/agents",
      },
      {
        id: "roles",
        labelKey: "nav.cortexConfig.roles",
        icon: Users,
        href: "/cortex-config/governance",
      },
      {
        id: "credentials",
        labelKey: "nav.cortexConfig.credentials",
        icon: KeyRound,
        href: "/cortex-config/credentials",
      },
    ],
  },
]

// Faza 1+2+3 (PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md
// §5): Kalkulator (Faza 1), Historia (Faza 2) i Ustawienia (Faza 3) mają
// fizyczne strony. Sekcja "Konfiguracja" dla Ustawień — wzorem
// INVOICE_SUPERVISOR_NAV (id "konfiguracja", nie "praca"): RBAC ma jeden
// poziom dostępu (D5 §7 pkt 3, bez osobnego scope'u "manage-settings"), ale
// wizualne rozdzielenie "codzienna praca" vs. "wspólna konfiguracja
// instancji" jest już ustalonym wzorcem UX w tym repo.
export const GEO_SCORE_CALCULATOR_NAV: NavSection[] = [
  {
    id: "praca",
    labelKey: "nav.sections.work",
    items: [
      {
        id: "kalkulator",
        labelKey: "nav.geoScore.calculator",
        icon: Calculator,
        href: "/geo-score-calculator",
      },
      {
        id: "historia",
        labelKey: "nav.geoScore.history",
        icon: History,
        href: "/geo-score-calculator/history",
      },
    ],
  },
  {
    id: "konfiguracja",
    labelKey: "nav.sections.configuration",
    items: [
      {
        id: "settings",
        labelKey: "nav.geoScore.settings",
        icon: Settings,
        href: "/geo-score-calculator/settings",
      },
    ],
  },
]

// Faza 0 (fundament) — rejestr sub-nawigacji dwóch ekranów zaprojektowanych w
// PROJECT/cortex-frontend-visual-guru-tile-projekt.md §6 (Generator/Archiwum),
// przed tym jak którykolwiek z nich fizycznie istnieje jako page.tsx (Faza
// 1/2). Nieszkodliwe do czasu aktywacji: kafelek jest dziś nieaktywnym
// kandydatem (seed-tile-manifests.mjs), więc TileMenu go jeszcze nie
// renderuje — wzorem GEO_SCORE_CALCULATOR_NAV wyżej.
export const VISUAL_GURU_NAV: NavSection[] = [
  {
    id: "praca",
    labelKey: "nav.sections.work",
    items: [
      {
        id: "generator",
        labelKey: "nav.visualGuru.generator",
        icon: Sparkles,
        href: "/visual-guru",
      },
      {
        id: "archiwum",
        labelKey: "nav.visualGuru.archive",
        icon: History,
        href: "/visual-guru/history",
      },
    ],
  },
]

// D1 (design doc, PROJECT/cortex-frontend-parser-dokumentow-port-projekt.md):
// dwa ekrany nawigowalne — upload jest trasą domyślną kafelka (manifest.ts),
// szczegóły joba (/document-parser/history/[id]) to drill-down z historii,
// nie osobna pozycja w sidebarze.
export const DOCUMENT_PARSER_NAV: NavSection[] = [
  {
    id: "praca",
    labelKey: "nav.sections.work",
    items: [
      {
        id: "upload",
        labelKey: "nav.documentParser.upload",
        icon: Upload,
        href: "/document-parser/upload",
      },
      {
        id: "history",
        labelKey: "nav.documentParser.history",
        icon: History,
        href: "/document-parser/history",
      },
    ],
  },
]

// Round D (PROJECT/cortex-frontend-content-guru-full-port-projekt.md D1/D8):
// pięć tras istnieją dziś (generowanie + historia + szablony + dwa profile)
// z docelowych sześciu — zakazane frazy to osobna runda, dopisywana tutaj
// dopiero gdy jej page.tsx realnie powstanie (wzorem komentarza przy
// GEO_SCORE_CALCULATOR_NAV — martwy link w sidebarze zanim ekran istnieje).
export const CONTENT_GURU_NAV: NavSection[] = [
  {
    id: "praca",
    labelKey: "nav.sections.work",
    items: [
      {
        id: "generowanie",
        labelKey: "nav.contentGuru.generation",
        icon: Sparkles,
        href: "/content-guru",
      },
      {
        id: "historia",
        labelKey: "nav.contentGuru.history",
        icon: History,
        href: "/content-guru/history",
      },
      {
        id: "szablony",
        labelKey: "nav.contentGuru.templates",
        icon: FileText,
        href: "/content-guru/templates",
      },
      {
        id: "profile-klienta",
        labelKey: "nav.contentGuru.client-profiles",
        icon: Building2,
        href: "/content-guru/client-profiles",
      },
      {
        id: "profile-rynku",
        labelKey: "nav.contentGuru.market-profiles",
        icon: LineChart,
        href: "/content-guru/market-profiles",
      },
    ],
  },
]

export const INVOICE_SUPERVISOR_NAV: NavSection[] = [
  {
    id: "praca",
    labelKey: "nav.sections.work",
    items: [
      {
        id: "inbox",
        labelKey: "nav.invoiceSupervisor.inbox",
        icon: Inbox,
        href: "/invoice-supervisor/inbox",
      },
      {
        id: "invoices",
        labelKey: "nav.invoiceSupervisor.invoices",
        icon: Receipt,
        href: "/invoice-supervisor/invoices",
      },
      {
        id: "clients",
        labelKey: "nav.invoiceSupervisor.clients",
        icon: Users,
        href: "/invoice-supervisor/clients",
      },
    ],
  },
  {
    id: "konfiguracja",
    labelKey: "nav.sections.configuration",
    items: [
      {
        id: "policies",
        labelKey: "nav.invoiceSupervisor.policies",
        icon: ScrollText,
        href: "/invoice-supervisor/policies",
      },
      {
        id: "templates",
        labelKey: "nav.invoiceSupervisor.templates",
        icon: FileText,
        href: "/invoice-supervisor/templates",
      },
      {
        id: "settings",
        labelKey: "nav.invoiceSupervisor.settings",
        icon: Settings,
        href: "/invoice-supervisor/settings",
      },
    ],
  },
  {
    id: "audyt",
    labelKey: "nav.sections.audit",
    items: [
      {
        id: "notifications",
        labelKey: "nav.invoiceSupervisor.notifications",
        icon: History,
        href: "/invoice-supervisor/notifications",
      },
    ],
  },
]

export const AI_TOOLS_DASHBOARD_ITEM: NavItem = {
  id: "dashboard",
  labelKey: "nav.aiTools.dashboard",
  icon: Sparkles,
  href: "/ai-tools",
}

/**
 * Zamienia klucze na napisy w języku, który jest AKTUALNIE wybrany. Wołane z
 * hooków niżej, czyli w komponencie — `t` z `useTranslation` zmienia
 * tożsamość przy zmianie języka, więc `useMemo` się przelicza i sidebar
 * przełącza się razem z resztą ekranu.
 */
export function translateNavSections(
  sections: readonly NavSection[],
  t: (key: string) => string,
): TileMenuSection[] {
  return sections.map(({ labelKey, items, ...section }) => ({
    ...section,
    ...(labelKey ? { label: t(labelKey) } : {}),
    items: items.map(({ labelKey: itemLabelKey, ...item }) => ({
      ...item,
      label: t(itemLabelKey),
    })),
  }))
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

/**
 * Która pozycja menu jest aktywna dla bieżącej ścieżki.
 *
 * DLACZEGO PO `href`, A NIE PO `id`. Poprzednia wersja wyliczała identyfikator
 * ze ścieżki (`pathToItemId()` w `(main)/layout.tsx`) i porównywała go z `id`
 * pozycji — czyli wymagała, żeby DWIE listy pozostały zgodne: mapowanie
 * segmentów i identyfikatory w tym pliku. Nic tego nie pilnowało i rozjechało
 * się w trzech miejscach naraz: korzeń kafelka bez podstrony dawał stałe
 * `"dashboard"`, więc `/content-guru` (`generowanie`),
 * `/geo-score-calculator` (`kalkulator`) i `/visual-guru` (`generator`) nie
 * podświetlały ŻADNEJ pozycji. Zmierzone na wdrożonej instancji 10.08.2026 —
 * razem z `aria-current`, więc sygnał „gdzie jestem" znikał też dla czytnika
 * ekranu, a nie tylko dla wzroku.
 *
 * `href` jest jedynym źródłem, które i tak MUSI być poprawne, żeby link
 * działał. Dopasowanie po nim usuwa całą klasę tego błędu zamiast naprawiać
 * trzy wystąpienia.
 *
 * NAJDŁUŻSZY pasujący prefiks, nie pierwszy: `/content-guru/history` pasuje
 * i do `/content-guru`, i do `/content-guru/history` — wygrać ma ta druga.
 * Granica segmentu jest sprawdzana wprost, bo `/content-guru-inny` nie jest
 * podstroną `/content-guru`.
 */
export function resolveActiveItemId(
  pathname: string,
  sections: readonly TileMenuSection[],
): string | undefined {
  let best: { id: string; length: number } | undefined

  for (const section of sections) {
    for (const item of section.items) {
      const href = item.href
      const matches = pathname === href || pathname.startsWith(`${href}/`)
      if (!matches) continue
      if (!best || href.length > best.length) best = { id: item.id, length: href.length }
    }
  }

  return best?.id
}

export function parseHiddenMenuItems(value: HiddenMenuItemsConfig): ReadonlySet<string> {
  const items = Array.isArray(value) ? value : (value ?? "").split(",")
  return new Set(items.map(normalizeMenuKey).filter(Boolean))
}

/**
 * Tokeny, po których `hide_menu_items` z backendu trafia w pozycję menu.
 *
 * Zamiast napisu idzie tu OSTATNI SEGMENT klucza tłumaczenia — token, który
 * nie zmienia się razem z językiem. Dla pozycji IDP (jedynych, których ta
 * konfiguracja dotyczy) jest on kebabową postacią dotychczasowej etykiety
 * („Rule editor" -> `rule-editor`), więc listy skonfigurowane po nazwie
 * działają dalej. Dopasowanie po WIDOCZNYM napisie byłoby tu pułapką: ta sama
 * konfiguracja ukrywałaby pozycję po polsku i przestawała działać po
 * przełączeniu na angielski.
 */
function itemKeys(item: NavItem): string[] {
  const hrefLeaf = item.href.split("/").filter(Boolean).at(-1) ?? ""
  const labelLeaf = item.labelKey.split(".").at(-1) ?? ""
  return [item.id, labelLeaf, item.href, hrefLeaf].map(normalizeMenuKey)
}

export function filterNavSections(
  sections: readonly NavSection[],
  hiddenItems: ReadonlySet<string>,
  options: { showAdminItems?: boolean } = {},
): NavSection[] {
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
  const { t } = useTranslation("common")
  const { data } = useFeatureFlags()
  const settings = useFeatureFlagSettings()
  const hiddenMenuItems = data?.hide_menu_items

  return useMemo(
    () =>
      translateNavSections(
        filterNavSections(IDP_NAV, parseHiddenMenuItems(hiddenMenuItems), {
          showAdminItems: settings.isSuccess,
        }),
        t,
      ),
    [hiddenMenuItems, settings.isSuccess, t],
  )
}

export function useIdpBasicNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(IDP_BASIC_NAV, t), [t])
}

export function useStorePitNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(STORE_PIT_NAV, t), [t])
}

export function useOknaCzasoweNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(OKNA_CZASOWE_NAV, t), [t])
}

export function useIntrastatNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(INTRASTAT_NAV, t), [t])
}

export function useIlustromatNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(ILUSTROMAT_NAV, t), [t])
}

export function useSystemConfigNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(SYSTEM_CONFIG_NAV, t), [t])
}

export function useTokenUsageNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(TOKEN_USAGE_NAV, t), [t])
}

export function useInvoiceSupervisorNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(INVOICE_SUPERVISOR_NAV, t), [t])
}

export function useGeoScoreCalculatorNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(GEO_SCORE_CALCULATOR_NAV, t), [t])
}

export function useVisualGuruNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(VISUAL_GURU_NAV, t), [t])
}

export function useDocumentParserNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(DOCUMENT_PARSER_NAV, t), [t])
}

export function useContentGuruNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(CONTENT_GURU_NAV, t), [t])
}

export function useAiToolsNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  // Krótkie nazwy narzędzi stoją w przestrzeni SAMEGO kafelka, nie w `tiles`:
  // nie są daną instancji, tylko skrótem prezentacyjnym (`i18n/ai-tool-names.ts`).
  const { t: tAiTools } = useTranslation("ai-tools")
  const authorized = useAuthorizedApps()

  return useMemo(() => {
    const tools = getVisibleAiTools(authorized.apps)
    const grouped = tools.reduce<Record<string, TileMenuItem[]>>((acc, tool) => {
      const items = acc[tool.category] ?? []
      items.push({
        id: tool.id,
        label: aiToolShortLabel(tAiTools, tool.id, tool.shortLabel),
        icon: tool.icon,
        href: `/ai-tools/${tool.id}`,
      })
      acc[tool.category] = items
      return acc
    }, {})

    const { labelKey: dashboardLabelKey, ...dashboardItem } = AI_TOOLS_DASHBOARD_ITEM

    return [
      {
        id: "home",
        label: t("nav.sections.home"),
        items: [{ ...dashboardItem, label: t(dashboardLabelKey) }],
      },
      ...Object.entries(grouped).map(([label, items]) => ({
        id: label.toLowerCase(),
        label,
        items,
      })),
    ]
  }, [authorized.apps, t, tAiTools])
}

export function useCortexConfigNavSections(): TileMenuSection[] {
  const { t } = useTranslation("common")
  return useMemo(() => translateNavSections(CORTEX_CONFIG_NAV, t), [t])
}
