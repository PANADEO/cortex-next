// Strażnik parzystości zamkniętych list prezentacyjnych między
// @cortex/tile-sdk (manifest kafelka, K1) a aplikacją, która te wartości
// renderuje: kategorie huba w lib/tiles.ts i paleta kolorów ikon w
// features/system-config/colors.ts.
//
// Dlaczego w ogóle istnieją dwie kopie: tile-sdk jest LIŚCIEM zależności —
// app/idp importuje z niego (manifesty, defineTile), więc odwrotny import jest
// wykluczony. Ten sam układ co APPLICATION_KINDS w @cortex/db, które dubluje
// TileKind i też jest pilnowane testem (src/schema/system-config.test.ts).
//
// Co się dzieje przy rozjeździe — i dlaczego nie widać go bez tego testu:
//   - lista w tile-sdk WĘŻSZA niż w aplikacji: kategoria dostępna w dropdownie
//     admina jest nieosiągalna dla dewelopera piszącego manifest, `defineTile()`
//     wywala build na wartości, która w bazie jest w pełni legalna,
//   - lista w tile-sdk SZERSZA: manifest przepuszcza wartość, dla której hub nie
//     ma zakładki (kafelek znika ze wszystkich filtrów) albo palety (ikona
//     spada na szary token) — bez błędu, cicho.
//
// Test lint/tsc same tego nie złapią: obie listy są poprawnym TypeScriptem
// osobno, a to, że mają być IDENTYCZNE, nie wynika z żadnego typu.

import {
  TileCategoryDepartment as SdkCategoryDepartment,
  TileCategoryFunctional as SdkCategoryFunctional,
  TileColor as SdkColor,
} from "@cortex/tile-sdk"
import { describe, expect, it } from "vitest"
import { TILE_COLOR_OPTIONS } from "../features/system-config/colors"
import type { TileCategoryDepartment, TileCategoryFunctional } from "./tiles"
import { DEPARTMENT_CATEGORIES, FUNCTIONAL_CATEGORIES } from "./tiles"

/** `true` wyłącznie gdy oba typy są wzajemnie przypisywalne. Asercję egzekwuje
 *  `pnpm typecheck`, NIE `expect` niżej — przy rozjeździe typ wyliczy się na
 *  `false` i przypisanie `= true` przestanie się kompilować. `expect` jest po
 *  to, żeby zmienna nie była martwa i żeby porażka miała nazwę w raporcie. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

describe("zamknięte listy prezentacyjne: @cortex/tile-sdk vs app/idp", () => {
  it("TileCategoryFunctional to ten sam TYP co w tiles.ts", () => {
    const parity: MutuallyAssignable<TileCategoryFunctional, SdkCategoryFunctional> = true
    expect(parity).toBe(true)
  })

  it("TileCategoryDepartment to ten sam TYP co w tiles.ts", () => {
    const parity: MutuallyAssignable<TileCategoryDepartment, SdkCategoryDepartment> = true
    expect(parity).toBe(true)
  })

  // Odpowiednik runtime: typ pilnuje dewelopera, a te trzy asercje pilnują tego,
  // co użytkownik naprawdę widzi — dropdowny formularza Aplikacja i swatche
  // palety renderują się z TABLIC, nie z typów. Rozszerzenie unii bez dopisania
  // pozycji do tablicy przechodzi kompilację i nie daje się wybrać w UI.
  it("FUNCTIONAL_CATEGORIES (dropdown admina) ma dokładnie te same wartości", () => {
    expect(FUNCTIONAL_CATEGORIES.map((category) => category.id).sort()).toEqual(
      [...SdkCategoryFunctional.options].sort(),
    )
  })

  it("DEPARTMENT_CATEGORIES (dropdown admina) ma dokładnie te same wartości", () => {
    expect(DEPARTMENT_CATEGORIES.map((category) => category.id).sort()).toEqual(
      [...SdkCategoryDepartment.options].sort(),
    )
  })

  it("TILE_COLOR_OPTIONS (paleta swatchy) ma dokładnie te same tokeny", () => {
    expect(TILE_COLOR_OPTIONS.map((option) => option.value).sort()).toEqual(
      [...SdkColor.options].sort(),
    )
  })
})
