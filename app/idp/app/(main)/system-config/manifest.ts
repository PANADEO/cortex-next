import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod (`system-config`)
// jest wierszem w tabeli applications — to po nim pyta requireTileAccess().
export const systemConfigTile = defineTile({
  id: "system-config",
  kind: "native",
  label: "Konfiguracja Systemu",
  entitlementCode: "system-config",
  route: "/system-config",
})
