import { resolveTileColor } from "@/features/system-config/colors"
import { resolveApplicationIcon } from "@/features/system-config/icons"
import { SOURCE_LOCALE } from "@/lib/i18n/config"
import type { Tile, TileCategoryDepartment, TileCategoryFunctional } from "@/lib/tiles"
import type { HubTile } from "@cortex/api"
import type { TFunction } from "i18next"

/**
 * `GET /api/hub/tiles` row -> `Tile` (kształt bez zmian, Krok 3,
 * PROJECT/cortex-frontend-hub-db-driven-projekt.md). WYŁĄCZNIE mapowanie
 * wyglądu — kto co widzi nadal rozstrzyga wyłącznie `canAccessTile()` w
 * hub/use-hub-model.ts, wołany PO tej mapie, na `authorized.apps` z
 * `/api/me/access` (D7 — ten plik nie ma i nie może mieć logiki dostępu).
 *
 * `id` = `code` (entitlement) — dokładnie to, po czym `canAccessTile`/
 * `authorized.apps.includes(...)` porównują dziś dla statycznych `TILES`.
 *
 * `archetype` nie ma odpowiednika w `applications` (D4 — świadomie nie
 * dodane, YAGNI: zero konsumenta na ścieżce renderu huba czyta to pole,
 * jedyny konsument dziś to walidacja governance Cortex Cowork nad zupełnie
 * innym źródłem danych) — stała `"dashboard"` jest więc bezpieczna dla
 * wszystkich kafelków z tej mapy.
 *
 * `kind="iframe"` traktowany jak `external-link` (`external: true`) — Faza 2
 * osadzania w chrome shellu jeszcze nie istnieje (tile-sdk: "jeszcze
 * nieużywane"), więc dziś nie ma ani jednego wiersza tego typu w rejestrze;
 * `Tile.external` to i tak tylko boolean (otwórz w nowej karcie / nie), bez
 * trzeciej opcji na "osadzony".
 */
/**
 * Tłumaczenie nazwy i opisu kafelka.
 *
 * Katalog huba idzie Z BAZY (`applications.name/description`), więc żadna
 * biblioteka i18n go nie obejmuje — to dane instancji, nie napisy w kodzie.
 *
 * W JĘZYKU ŹRÓDŁOWYM WYGRYWA BAZA, i to jest sedno tej funkcji. Pierwsza
 * wersja nakładała tłumaczenie także na polski, przez co **zmiana nazwy
 * kafelka przez administratora była niewidoczna** — plik w repo przykrywał
 * to, co admin przed chwilą wpisał w panelu. Sprzeczne z zasadą fazy K
 * (manifest podaje wartość POCZĄTKOWĄ, właścicielem w runtime jest admin)
 * i wprost z tym, o co prosił Alex.
 *
 * W pozostałych językach tłumaczenie wygrywa, a brak klucza spada na wartość
 * z bazy — czyli kafelek założony w panelu pokaże swoją polską nazwę zamiast
 * surowego klucza. Ograniczenie znane i widoczne; znosi je dopiero pole na
 * tłumaczenie w ustawieniach kafelka (§Otwarte projektu i18n).
 */
function translated(
  t: TFunction<"tiles">,
  locale: string,
  code: string,
  field: "label" | "description",
  fromDatabase: string,
): string {
  if (locale === SOURCE_LOCALE) return fromDatabase
  const value = t(`${code}.${field}`, { defaultValue: "" })
  return value || fromDatabase
}

export function hubApplicationToTile(row: HubTile, t: TFunction<"tiles">, locale: string): Tile {
  const { iconBg, iconFg } = resolveTileColor(row.color)

  return {
    id: row.code,
    label: translated(t, locale, row.code, "label", row.name),
    description: translated(t, locale, row.code, "description", row.description ?? ""),
    // Niezmiennik kształtu w bazie (`applications_kind_shape`) gwarantuje
    // route dla native i url dla pozostałych — fallback tylko dla typów.
    href: (row.kind === "native" ? row.route : row.url) ?? "#",
    external: row.kind !== "native",
    icon: resolveApplicationIcon(row.icon),
    iconBg,
    iconFg,
    categoryFunctional: (row.categoryFunctional as TileCategoryFunctional | null) ?? null,
    categoryDepartment: (row.categoryDepartment ?? []) as TileCategoryDepartment[],
    archetype: "dashboard",
  }
}

export function hubApplicationsToTiles(
  rows: readonly HubTile[],
  t: TFunction<"tiles">,
  locale: string,
): Tile[] {
  return rows.map((row) => hubApplicationToTile(row, t, locale))
}
