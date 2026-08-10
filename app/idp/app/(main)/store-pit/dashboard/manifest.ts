import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("sp-console") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Współdzieli folder `store-pit/` z `sp-client`
// (manifest.ts drugiego kafelka leży w `store-pit/clients/`) — żaden z nich
// nie jest "kafelkiem store-pit" samym w sobie, więc manifest siedzi obok
// konkretnej strony, którą opisuje (`store-pit/dashboard/page.tsx`), nie w
// katalogu nadrzędnym.
export const spConsoleTile = defineTile({
  id: "sp-console",
  kind: "native",
  label: "Store-Pit Re-Rating",
  entitlementCode: "sp-console",
  route: "/store-pit/dashboard",
  description: "Przeliczanie faktur przewoźnika na rozliczenia per klient",
  icon: "Workflow",
  color: "cyan",
  categoryFunctional: "agents",
  categoryDepartment: ["finance", "operations"],
  sortOrder: 20,
})
