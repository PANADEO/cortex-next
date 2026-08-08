import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod
// ("intrastat-config-editor") jest wierszem w tabeli
// system_config.applications — to po nim pyta requireTileAccess(). Czysta
// flaga funkcji (D1 §1.3 w PROJECT/cortex-frontend-hub-db-driven-projekt.md):
// odblokowuje przycisk edycji ustawień WEWNĄTRZ kafelka Intrastat (manifest
// główny: `intrastat/manifest.ts`). Realną egzekucją zajmuje się zewnętrzny
// backend Intrastatu. Stąd `entitlementOnly` niżej: to ono daje
// `show_on_hub=false` na INSERCIE i powstrzymuje activateApplication() przed
// wystawieniem karty (K1b).
export const intrastatConfigEditorTile = defineTile({
  id: "intrastat-config-editor",
  kind: "native",
  label: "Intrastat — edycja konfiguracji",
  entitlementCode: "intrastat-config-editor",
  route: "/intrastat/settings",
  entitlementOnly: true,
})
