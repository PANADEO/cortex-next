import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("invoice-supervisor")
// jest wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Musi się zgadzać z settings.application_name
// backend-next — cortex-admin's authorized-apps check keys off this exact
// string (patrz komentarz w app/idp/lib/tiles.ts).
export const invoiceSupervisorTile = defineTile({
  id: "invoice-supervisor",
  kind: "native",
  label: "Nadzorca Faktur",
  entitlementCode: "invoice-supervisor",
  route: "/invoice-supervisor/inbox",
  description: "Nadzoruje terminy faktur i generuje AI przypomnienia płatnicze",
  icon: "Receipt",
  color: "orange",
  categoryFunctional: "misc",
  categoryDepartment: ["finance", "operations"],
  sortOrder: 80,
})
