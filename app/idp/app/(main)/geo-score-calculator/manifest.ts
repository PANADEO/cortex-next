import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("geo-score-calculator")
// jest wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Jeden poziom dostępu na start (D5, PROJECT/
// cortex-frontend-geo-score-calculator-port-projekt.md §2/§7 pkt 3) — bez
// osobnego scope'u dla Ustawień, mirror dzisiejszego geo_calc i zasady YAGNI
// już stosowanej w tym repo.
//
// FAZA 0 (fundament): tylko ten manifest — zero page.tsx pod tym folderem
// jeszcze. `route` wskazuje na przyszły ekran kalkulatora (Faza 1), zgodnie
// z D1 (segment trasy: geo-score-calculator, angielski/kebab-case). Do
// pierwszej realnej aktywacji ten kod jest widoczny WYŁĄCZNIE jako
// nieaktywny kandydat w formularzu "Dodaj aplikację" — świadomie, patrz
// packages/@cortex/db/scripts/seed-geo-score-calculator.mjs.
export const geoScoreCalculatorTile = defineTile({
  id: "geo-score-calculator",
  kind: "native",
  label: "Kalkulator GEO Score",
  entitlementCode: "geo-score-calculator",
  route: "/geo-score-calculator",
})
