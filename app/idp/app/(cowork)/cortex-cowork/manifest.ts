import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("cortex-cowork") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). `show_on_hub=false` w seedzie (grant zbiorczy: sam
// kod nigdy nie renderuje własnej karty, tylko bramkuje rodzinę per-projekt
// kafelków dociąganych z governance store — D1/D8 w
// PROJECT/cortex-frontend-hub-db-driven-projekt.md).
export const cortexCoworkTile = defineTile({
  id: "cortex-cowork",
  kind: "native",
  label: "Cortex Cowork",
  entitlementCode: "cortex-cowork",
  route: "/cortex-cowork",
})
