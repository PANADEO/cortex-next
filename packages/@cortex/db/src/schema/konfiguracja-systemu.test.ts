import { TileKind } from "@cortex/tile-sdk"
import { describe, expect, it } from "vitest"
import { APPLICATION_KINDS } from "./konfiguracja-systemu"

describe("APPLICATION_KINDS", () => {
  // Wartości dozwolone w bazie (check constraint applications_kind_allowed)
  // muszą odpowiadać TileKind z @cortex/tile-sdk. Rozjazd oznaczałby, że UI
  // pozwala zapisać typ, który baza odrzuci — albo odwrotnie.
  it("pokrywa się z TileKind z tile-sdk", () => {
    expect([...APPLICATION_KINDS].sort()).toEqual([...TileKind.options].sort())
  })
})
