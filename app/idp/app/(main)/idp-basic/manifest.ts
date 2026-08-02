import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("idp-basic") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess().
export const idpBasicTile = defineTile({
  id: "idp-basic",
  kind: "native",
  label: "IDP Basic",
  entitlementCode: "idp-basic",
  route: "/idp-basic/dashboard",
})
