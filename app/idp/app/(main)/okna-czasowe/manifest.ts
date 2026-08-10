import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("okna-czasowe") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess().
export const oknaCzasoweTile = defineTile({
  id: "okna-czasowe",
  kind: "native",
  label: "Okna czasowe",
  entitlementCode: "okna-czasowe",
  route: "/okna-czasowe/dashboard",
  description: "Śledzenie dostępności filmów na Rakuten TV PL",
  icon: "CalendarClock",
  color: "amber",
  categoryFunctional: "research",
  categoryDepartment: ["marketing"],
  sortOrder: 40,
})
