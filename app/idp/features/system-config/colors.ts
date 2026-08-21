// `applications.color` -> klasy Tailwind ikony kafelka (D2,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md). Kolumna trzyma NAZWĘ
// tokenu ("rose", "sky", ...), NIE surowe klasy — Tailwind (JIT, `content` w
// tailwind.config.ts) generuje CSS wyłącznie dla klas obecnych jako LITERALNY
// STRING w skanowanych plikach źródłowych. Klasa złożona w runtime z wartości
// bazy (np. `` `bg-${color}-200` ``) nigdy by się nie wygenerowała — kafelek
// renderowałby się bez koloru, bez żadnego błędu. Stąd zamknięta mapa
// literałów, jak `resolveApplicationIcon` obok w icons.ts.
//
// Paleta zweryfikowana w projekcie: dokładnie te 11 rodzin kolorów są dziś
// używane przez app/idp/lib/tiles.ts (TILES + AI_TOOL_TILE_STYLE) i
// features/cortex-cowork/hooks/use-project-tiles.ts (`violet`). Wartości par
// klas są 1:1 z tamtymi miejscami — migracja legacy kafelków do bazy
// (seed-system-config.mjs) więc renderuje się identycznie jak dziś.
export interface TileColorClasses {
  iconBg: string
  iconFg: string
}

const NEUTRAL_TOKEN = "slate"

const TILE_COLORS: Record<string, TileColorClasses> = {
  rose: { iconBg: "bg-rose-200 dark:bg-rose-900/40", iconFg: "text-rose-700 dark:text-rose-300" },
  sky: { iconBg: "bg-sky-200 dark:bg-sky-900/40", iconFg: "text-sky-700 dark:text-sky-300" },
  cyan: { iconBg: "bg-cyan-200 dark:bg-cyan-900/40", iconFg: "text-cyan-700 dark:text-cyan-300" },
  indigo: {
    iconBg: "bg-indigo-200 dark:bg-indigo-900/40",
    iconFg: "text-indigo-700 dark:text-indigo-300",
  },
  amber: {
    iconBg: "bg-amber-200 dark:bg-amber-900/40",
    iconFg: "text-amber-700 dark:text-amber-300",
  },
  emerald: {
    iconBg: "bg-emerald-200 dark:bg-emerald-900/40",
    iconFg: "text-emerald-700 dark:text-emerald-300",
  },
  violet: {
    iconBg: "bg-violet-200 dark:bg-violet-900/40",
    iconFg: "text-violet-700 dark:text-violet-300",
  },
  slate: {
    iconBg: "bg-slate-200 dark:bg-slate-800/60",
    iconFg: "text-slate-700 dark:text-slate-300",
  },
  teal: { iconBg: "bg-teal-200 dark:bg-teal-900/40", iconFg: "text-teal-700 dark:text-teal-300" },
  orange: {
    iconBg: "bg-orange-200 dark:bg-orange-900/40",
    iconFg: "text-orange-700 dark:text-orange-300",
  },
  blue: { iconBg: "bg-blue-200 dark:bg-blue-900/40", iconFg: "text-blue-700 dark:text-blue-300" },
}

/** Podpowiedzi dla palety swatchy w formularzu Aplikacja (KLUCZ etykiety w
 *  przestrzeni `system-config` + klasy do podglądu) — kolejność jak w tabeli D2
 *  (paleta zweryfikowana). Klucz, nie gotowy napis: ten moduł nie jest
 *  komponentem, więc nie ma skąd wziąć `t`. */
export const TILE_COLOR_OPTIONS: ReadonlyArray<
  { value: string; labelKey: string } & TileColorClasses
> = [
  { value: "rose", labelKey: "applications.color.rose", ...TILE_COLORS.rose! },
  { value: "sky", labelKey: "applications.color.sky", ...TILE_COLORS.sky! },
  { value: "cyan", labelKey: "applications.color.cyan", ...TILE_COLORS.cyan! },
  { value: "indigo", labelKey: "applications.color.indigo", ...TILE_COLORS.indigo! },
  { value: "amber", labelKey: "applications.color.amber", ...TILE_COLORS.amber! },
  { value: "emerald", labelKey: "applications.color.emerald", ...TILE_COLORS.emerald! },
  { value: "violet", labelKey: "applications.color.violet", ...TILE_COLORS.violet! },
  { value: "slate", labelKey: "applications.color.slate", ...TILE_COLORS.slate! },
  { value: "teal", labelKey: "applications.color.teal", ...TILE_COLORS.teal! },
  { value: "orange", labelKey: "applications.color.orange", ...TILE_COLORS.orange! },
  { value: "blue", labelKey: "applications.color.blue", ...TILE_COLORS.blue! },
]

/** `applications.color` -> para klas ikony kafelka, z fallbackiem na
 *  neutralny token dla pustej/nieznanej wartości (literówka, legacy NULL). */
export function resolveTileColor(name: string | null | undefined): TileColorClasses {
  if (!name) return TILE_COLORS[NEUTRAL_TOKEN]!
  return TILE_COLORS[name] ?? TILE_COLORS[NEUTRAL_TOKEN]!
}
