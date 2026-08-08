import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("cortex-config") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). NIE mylić z kafelkiem "system-config" — to jest
// governance Cortex Cowork (projekty agentowe, role, grupy skilli), nie
// konfiguracja systemu.
export const cortexConfigTile = defineTile({
  id: "cortex-config",
  kind: "native",
  label: "Cortex Config",
  entitlementCode: "cortex-config",
  route: "/cortex-config/projects",
  description: "Governance platformy — projekty agentowe, role i grupy skilli",
  icon: "ShieldCheck",
  color: "emerald",
  categoryFunctional: "admin-system",
  categoryDepartment: ["it"],
  sortOrder: 50,
})
