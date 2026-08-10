import { resolveTileColor } from "@/features/system-config/colors"
import { resolveApplicationIcon } from "@/features/system-config/icons"
import type { Tile, TileCategoryDepartment, TileCategoryFunctional } from "@/lib/tiles"
import type { HubTile } from "@cortex/api"

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
export function hubApplicationToTile(row: HubTile): Tile {
  const { iconBg, iconFg } = resolveTileColor(row.color)

  return {
    id: row.code,
    label: row.name,
    description: row.description ?? "",
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

export function hubApplicationsToTiles(rows: readonly HubTile[]): Tile[] {
  return rows.map(hubApplicationToTile)
}
