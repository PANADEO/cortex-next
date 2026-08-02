import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("intrastat") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Dwie flagi funkcji WEWNĄTRZ tego kafelka
// (`intrastat-cn-editor`, `intrastat-config-editor`) mają własne manifesty w
// `intrastat/resources/` i `intrastat/settings/` — patrz komentarze tamtych
// plików.
export const intrastatTile = defineTile({
  id: "intrastat",
  kind: "native",
  label: "Intrastat",
  entitlementCode: "intrastat",
  route: "/intrastat/dashboard",
})
