import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod (`konfiguracja-systemu`)
// jest wierszem w tabeli applications — to po nim pyta requireTileAccess().
export const konfiguracjaSystemuTile = defineTile({
  id: "konfiguracja-systemu",
  kind: "native",
  label: "Konfiguracja Systemu",
  entitlementCode: "konfiguracja-systemu",
})
