// Strażnik jedynego pola manifestu, które ma zamknięty, wyliczalny zbiór
// posiadaczy: `entitlementOnly` (K1b, PROJECT/cortex-frontend/ARTIFACTS/
// licencjonowanie/cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md §4).
//
// Cztery kody w rejestrze nie są kafelkami, tylko uprawnieniami — `ai-tools`
// i `cortex-cowork` (granty zbiorcze: kod sam nie renderuje własnej karty,
// bramkuje rodzinę kafelków renderowaną gdzie indziej) oraz
// `intrastat-cn-editor`/`intrastat-config-editor` (odblokowują przyciski
// edycji WEWNĄTRZ kafelka Intrastat). Do K3 trzyma je poza hubem statyczna
// lista APPLICATIONS w seed-system-config.mjs; po K3 wyłącznie to pole.
//
// Test pilnuje OBU kierunków rozjazdu, bo mają różny koszt:
//   - pole zapomniane przy uprawnieniu -> nadmiarowa karta na hubie
//     prowadząca do ekranu, który kafelkiem nie jest (dokładnie ta regresja,
//     dla której K1b powstał),
//   - pole dopisane prawdziwemu kafelkowi -> kafelek znika z huba po
//     aktywacji, bez błędu i bez śladu w logu; admin ma tylko przełącznik
//     "Widoczna na stronie głównej", żeby to odkręcić, jeśli w ogóle wpadnie
//     na to, żeby go szukać.
//
// Lista jest wypisana wprost, a nie liczona — dopisanie piątego uprawnienia
// ma wymagać świadomej zmiany testu, tak samo jak zbiór APPLICATION_KINDS
// w @cortex/db.

import { describe, expect, it } from "vitest"
import { ALL_TILE_MANIFESTS } from "./tile-manifests"

const ENTITLEMENT_ONLY_CODES = [
  "ai-tools",
  "cortex-cowork",
  "intrastat-cn-editor",
  "intrastat-config-editor",
]

describe("ALL_TILE_MANIFESTS — entitlementOnly niosą dokładnie cztery znane kody", () => {
  it("zbiór manifestów z entitlementOnly zgadza się co do jednego kodu", () => {
    const marked = ALL_TILE_MANIFESTS.filter((manifest) => manifest.entitlementOnly === true).map(
      (manifest) => manifest.entitlementCode,
    )

    expect([...marked].sort()).toEqual([...ENTITLEMENT_ONLY_CODES].sort())
  })

  it("pozostałe manifesty NIE mają tego klucza w ogóle — `false` byłoby drugim zapisem tego samego", () => {
    const rest = ALL_TILE_MANIFESTS.filter(
      (manifest) => !ENTITLEMENT_ONLY_CODES.includes(manifest.entitlementCode),
    )

    expect(rest.length).toBeGreaterThan(0)
    for (const manifest of rest) {
      expect(manifest).not.toHaveProperty("entitlementOnly")
    }
  })

  // Kontrola do obu asercji wyżej: gdyby barrel przestał być kompletny (import
  // zapomniany przy dodawaniu kafelka — jedyny realny sposób, w jaki manifest
  // wypada z rejestru), pierwszy test dalej by przechodził na okrojonym
  // zbiorze, o ile z rejestru wypadłby akurat kafelek, a nie uprawnienie.
  it("barrel niesie komplet manifestów i każdy ma unikalny entitlementCode", () => {
    const codes = ALL_TILE_MANIFESTS.map((manifest) => manifest.entitlementCode)

    expect(codes.length).toBe(new Set(codes).size)
    expect(codes.length).toBeGreaterThanOrEqual(ENTITLEMENT_ONLY_CODES.length)
    for (const code of ENTITLEMENT_ONLY_CODES) {
      expect(codes).toContain(code)
    }
  })
})
