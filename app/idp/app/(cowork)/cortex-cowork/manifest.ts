import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("cortex-cowork") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Grant ZBIORCZY: sam kod nigdy nie renderuje własnej
// karty, tylko bramkuje rodzinę per-projekt kafelków dociąganych z governance
// store — D1/D8 w PROJECT/cortex-frontend-hub-db-driven-projekt.md. Stąd
// `entitlementOnly` niżej: to ono daje `show_on_hub=false` na INSERCIE i
// powstrzymuje activateApplication() przed wystawieniem karty (K1b).
export const cortexCoworkTile = defineTile({
  id: "cortex-cowork",
  kind: "native",
  label: "Cortex Cowork",
  entitlementCode: "cortex-cowork",
  route: "/cortex-cowork",
  entitlementOnly: true,
})
