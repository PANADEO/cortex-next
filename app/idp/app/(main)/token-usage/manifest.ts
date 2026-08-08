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
//
// K2: wartości prezentacyjne niżej odczytane 08.08.2026 z bazy `cortex`, nie
// przeniesione z APPLICATIONS — tego kodu tam nigdy nie było. Drugie źródło
// w repo (UPDATE w packages/@cortex/db/scripts/seed-token-usage.mjs) zostaje
// z dokładnie tego samego powodu co przy Ilustromacie — patrz komentarz w
// app/idp/app/(main)/ilustromat/manifest.ts, ten sam przypadek.
export const tokenUsageTile = defineTile({
  id: "token-usage",
  kind: "native",
  label: "Raportowanie Tokenów",
  entitlementCode: "token-usage",
  route: "/token-usage",
  description: "Zużycie tokenów AI według użytkowników, modeli i narzędzi",
  icon: "BarChart3",
  color: "sky",
  categoryFunctional: "admin-system",
  categoryDepartment: ["it"],
})
