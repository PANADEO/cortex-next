import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("intrastat-cn-editor")
// jest wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Czysta flaga funkcji (D1 §1.3 w
// PROJECT/cortex-frontend-hub-db-driven-projekt.md): odblokowuje przycisk
// edycji słownika kodów CN WEWNĄTRZ kafelka Intrastat (manifest główny:
// `intrastat/manifest.ts`). Realną egzekucją zajmuje się zewnętrzny backend
// Intrastatu. Stąd `entitlementOnly` niżej: to ono daje `show_on_hub=false` na
// INSERCIE i powstrzymuje activateApplication() przed wystawieniem karty (K1b).
export const intrastatCnEditorTile = defineTile({
  id: "intrastat-cn-editor",
  kind: "native",
  label: "Intrastat — edycja kodów CN",
  entitlementCode: "intrastat-cn-editor",
  route: "/intrastat/resources",
  entitlementOnly: true,
  description: "Uprawnienie: edycja słownika kodów CN wewnątrz kafelka Intrastat",
  icon: "FileSpreadsheet",
  sortOrder: 210,
})
