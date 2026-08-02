import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("token-usage") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess().
//
// Kafelek jest ADMIN-ONLY w praktyce, choćby nie było tego w typie: za bramką
// leży odpowiedź GET /usage, czyli lista e-maili wszystkich użytkowników
// instancji wraz z ich aktywnością. Grant w seedzie dostaje wyłącznie rola
// administracyjna — patrz packages/@cortex/db/scripts/seed-token-usage.mjs.
//
// Warstwy granularnej (application_scopes) świadomie NIE ma: cały ekran ma
// jeden poziom dostępu, tak samo jak dziś w cortex-admin.
export const tokenUsageTile = defineTile({
  id: "token-usage",
  kind: "native",
  label: "Raportowanie Tokenów",
  entitlementCode: "token-usage",
  route: "/token-usage",
})
