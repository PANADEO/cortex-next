import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod (`system-config`)
// jest wierszem w tabeli applications — to po nim pyta requireTileAccess().
export const systemConfigTile = defineTile({
  id: "system-config",
  kind: "native",
  label: "Konfiguracja Systemu",
  entitlementCode: "system-config",
  route: "/system-config",
  description: "Użytkownicy, role, uprawnienia i aplikacje instancji",
  icon: "Settings",
  color: "slate",
  categoryFunctional: "admin-system",
  categoryDepartment: ["it"],
  sortOrder: 100,
})
