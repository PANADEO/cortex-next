import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("sp-client") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Współdzieli folder `store-pit/` z `sp-console`
// (manifest.ts drugiego kafelka leży w `store-pit/dashboard/`) — patrz
// komentarz tamtego pliku.
export const spClientTile = defineTile({
  id: "sp-client",
  kind: "native",
  label: "Store-Pit Client Zone",
  entitlementCode: "sp-client",
  route: "/store-pit/clients",
})
