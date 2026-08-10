import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("idp") jest wierszem w
// tabeli system_config.applications — to po nim pyta requireTileAccess().
export const idpTile = defineTile({
  id: "idp",
  kind: "native",
  label: "IDP",
  entitlementCode: "idp",
  route: "/idp/dashboard",
  description: "Procesowanie i ekstrakcja danych z dokumentów handlowych",
  icon: "ScanText",
  color: "rose",
  categoryFunctional: "misc",
  categoryDepartment: ["operations"],
  sortOrder: 0,
})
