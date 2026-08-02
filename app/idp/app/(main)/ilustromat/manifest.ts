import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("ilustromat") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Warstwa granularna (kto zarządza szablonami marki)
// idzie przez scope "manage-templates", nie przez osobny kafelek.
export const ilustromatTile = defineTile({
  id: "ilustromat",
  kind: "native",
  label: "Ilustromat",
  entitlementCode: "ilustromat",
  route: "/ilustromat/generation",
})
