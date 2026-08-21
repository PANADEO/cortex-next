import { useHubTiles, usePackage } from "@cortex/api"
import type { TFunction } from "i18next"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { getAiToolDefinition } from "./ai-tools/registry"
import i18n from "./i18n"
import { aiToolShortLabel } from "./i18n/ai-tool-names"
import { tileText, type TileTranslations } from "./i18n/tile-translations"
import type { NavSection } from "./nav"
import {
  CORTEX_CONFIG_NAV,
  IDP_BASIC_NAV,
  IDP_NAV,
  ILUSTROMAT_NAV,
  INTRASTAT_NAV,
  INVOICE_SUPERVISOR_NAV,
  OKNA_CZASOWE_NAV,
  STORE_PIT_NAV,
  SYSTEM_CONFIG_NAV,
  TOKEN_USAGE_NAV,
} from "./nav"
import { resolveRequiredTileId, TILES } from "./tiles"

export interface BreadcrumbEntry {
  label: string
  href?: string
}

// Nav sections per URL root segment — the SAME registry `(main)/layout.tsx`
// wires into the sidebar (`navByTile`), keyed the same way (by URL segment,
// not always a tile id: `store-pit` hosts two tiles, sp-console/sp-client,
// under one shared segment). This is what makes breadcrumb middle-segment
// labels match the sidebar. A tile missing here still gets a WORKING link
// (never `/idp/*`) via the root-label resolution below — just with the raw
// URL segment as label instead of a friendly one.
const NAV_SECTIONS_BY_SEGMENT: Record<string, NavSection[]> = {
  idp: IDP_NAV,
  "idp-basic": IDP_BASIC_NAV,
  "store-pit": STORE_PIT_NAV,
  "okna-czasowe": OKNA_CZASOWE_NAV,
  "cortex-config": CORTEX_CONFIG_NAV,
  "system-config": SYSTEM_CONFIG_NAV,
  "token-usage": TOKEN_USAGE_NAV,
  intrastat: INTRASTAT_NAV,
  "invoice-supervisor": INVOICE_SUPERVISOR_NAV,
  ilustromat: ILUSTROMAT_NAV,
}

// Route segments that aren't sidebar nav items (detail sub-pages, mostly) but
// still deserve a friendly breadcrumb label instead of the raw segment.
// Wartości to KLUCZE tłumaczeń z przestrzeni `common` (wzorem `nav.ts`), nie
// napisy — okruszek stoi w tej samej powłoce co sidebar i ma przełączać język
// razem z nim.
const EXTRA_ROUTE_LABEL_KEYS_BY_SEGMENT: Record<string, Record<string, string>> = {
  "idp-basic": {
    dashboard: "nav.idpBasic.dashboard",
    packages: "nav.idpBasic.packages",
    results: "nav.idpBasic.results",
  },
  intrastat: {
    dashboard: "nav.intrastat.dashboard",
    batches: "nav.intrastat.batches",
    review: "nav.intrastat.review",
    settings: "nav.intrastat.settings",
  },
}

/** Napis w języku wybranym w tej chwili. Domyślnie z jedynej instancji
 *  i18next — `breadcrumbsFromPath` jest funkcją czystą wołaną także spoza
 *  komponentu, więc nie ma skąd wziąć `t` z kontekstu Reacta. Hook niżej
 *  podaje własne `t`, żeby przeliczyć okruszek przy zmianie języka. */
type Translate = (key: string) => string

const translateWithSharedInstance: Translate = (key) => i18n.t(key, { ns: "common" })

/**
 * Tłumaczenia nazw kafelków, kluczowane KODEM aplikacji — dokładnie ta sama
 * dana, z której hub składa etykiety kafelków (`hub-tile.ts`), i ta sama
 * reguła rozstrzygania. Korzeń okruszka JEST nazwą kafelka, więc drugie
 * źródło dla niego znaczyłoby dwie różne nazwy tej samej rzeczy na jednym
 * ekranie — w interfejsie angielskim „Konfiguracja Systemu" w topbarze nad
 * kafelkiem „System Configuration".
 *
 * PUSTA MAPA jest poprawnym wejściem, nie awarią: `breadcrumbsFromPath` bywa
 * wołane poza Reactem, katalog może jeszcze nie wrócić z sieci, a kafelek
 * wyłączony albo ukryty z huba w ogóle w nim nie występuje (trasa filtruje po
 * `is_active AND show_on_hub`). We wszystkich tych przypadkach spadamy na
 * etykietę z rejestru `TILES` — nazwa zdegradowana do języka źródłowego, nigdy
 * surowy segment URL-a.
 */
const NO_TILE_TRANSLATIONS: Record<string, TileTranslations> = {}

/** Krótka nazwa narzędzia AI stoi w przestrzeni kafelka AI Tools, nie
 *  w `tiles` — patrz `i18n/ai-tool-names.ts`. */
const sharedAiToolsTranslator = () => i18n.getFixedT(null, "ai-tools")

const PACKAGE_DETAIL_PATTERN = /^\/idp\/packages\/([^/]+)\/?$/

function navLabelKeysForSegment(segment: string): Record<string, string> {
  const sections = NAV_SECTIONS_BY_SEGMENT[segment]
  const fromNav = sections
    ? Object.fromEntries(
        sections.flatMap((section) => section.items).map((item) => [item.id, item.labelKey]),
      )
    : {}
  return { ...EXTRA_ROUTE_LABEL_KEYS_BY_SEGMENT[segment], ...fromNav }
}

/**
 * Resolves the display label for a URL root segment from `TILES` — the same
 * registry the sidebar reads its labels from — instead of a second,
 * hand-maintained tileId -> label list. Two shapes:
 *  - segment IS a tile id (idp, idp-basic, cortex-config, ...): direct lookup.
 *  - segment hosts tile(s) under a shared prefix (store-pit -> sp-console /
 *    sp-client): delegate to `resolveRequiredTileId`, the same resolver the
 *    access-control gate uses, so the breadcrumb and the gate never disagree
 *    about which tile a path belongs to.
 * Returns `undefined` when the segment matches no tile at all.
 */
function labelForSegment(
  pathname: string,
  segment: string,
  tileTranslations: Record<string, TileTranslations>,
  locale: string,
): string | undefined {
  const direct = TILES.find((tile) => tile.id === segment)
  if (direct) return tileText(tileTranslations[direct.id], locale, "name", direct.label)
  const resolvedId = resolveRequiredTileId(pathname)
  if (!resolvedId) return undefined
  const resolved = TILES.find((tile) => tile.id === resolvedId)
  return resolved
    ? tileText(tileTranslations[resolved.id], locale, "name", resolved.label)
    : undefined
}

export function breadcrumbsFromPath(
  pathname: string,
  t: Translate = translateWithSharedInstance,
  tileTranslations: Record<string, TileTranslations> = NO_TILE_TRANSLATIONS,
  locale: string = i18n.language,
  tAiTools: TFunction<"ai-tools"> = sharedAiToolsTranslator(),
): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "IDP" }]

  if (segments[0] === "ai-tools") {
    const hub = { label: t("nav.hub"), href: "/" }
    const tool = getAiToolDefinition(segments[1] ?? "")
    if (tool) return [hub, { label: aiToolShortLabel(tAiTools, tool.id, tool.shortLabel) }]
    return [hub]
  }

  const segment = segments[0] ?? ""
  const label = labelForSegment(pathname, segment, tileTranslations, locale)
  const root: BreadcrumbEntry = label ? { label, href: "/" } : { label: "IDP" }
  const rest = label ? segments.slice(1) : segments
  if (rest.length === 0) return [root]

  const navLabelKeys = label ? navLabelKeysForSegment(segment) : {}
  const trail: BreadcrumbEntry[] = [root]
  let accum = label ? `/${segment}` : "/idp"
  rest.forEach((seg, idx) => {
    accum += `/${seg}`
    const labelKey = navLabelKeys[seg]
    const entryLabel = labelKey ? t(labelKey) : seg
    const isLast = idx === rest.length - 1
    trail.push(isLast ? { label: entryLabel } : { label: entryLabel, href: accum })
  })
  return trail
}

export function useResolvedBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  const { t, i18n: instance } = useTranslation("common")
  const { t: tAiTools } = useTranslation("ai-tools")
  const match = pathname.match(PACKAGE_DETAIL_PATTERN)
  const packageId = match?.[1] ?? ""
  const pkg = usePackage(packageId, { polling: false })
  const displayName = pkg.data ? (pkg.data.package_name ?? pkg.data.file_name) : undefined
  // Ten sam katalog i to samo zapytanie, z którego renderuje się hub —
  // react-query trzyma je pod jednym kluczem, więc topbar nie dokłada rundy
  // do sieci na każdą nawigację, tylko dołącza do wpisu, który hub i tak
  // pobiera (`staleTime` 30 s, bez refetchu na focus).
  const hub = useHubTiles()
  const tileTranslations = useMemo(
    () => Object.fromEntries(hub.tiles.map((tile) => [tile.code, tile.translations])),
    [hub.tiles],
  )

  return useMemo(() => {
    const trail = breadcrumbsFromPath(pathname, t, tileTranslations, instance.language, tAiTools)
    if (!packageId || !displayName) return trail
    const last = trail[trail.length - 1]
    if (!last || last.label !== packageId) return trail
    return [...trail.slice(0, -1), { ...last, label: displayName }]
  }, [pathname, packageId, displayName, t, tileTranslations, tAiTools, instance.language])
}
