import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("document-parser") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Sprawdzony grepem przed nazwaniem — brak kolizji z
// istniejącymi kafelkami (code-tile "Znane kolizje nazw").
//
// Route wskazuje na Fazę 3 (3 ekrany FE, D1) — od tej rundy zbudowaną
// (app/idp/app/(main)/document-parser/{upload,history,history/[id]}). Wciąż
// zarejestrowany jako NIEAKTYWNY kandydat (is_active=false,
// seed-tile-manifests.mjs; `show_on_hub` od K1b bierze się z manifestu i dla
// tego kafelka jest `true` — niewidoczność daje samo `is_active=false`,
// bo listHubApplications() wymaga obu) — dokładnie ten sam mechanizm, którym każdy inny
// natywny kafelek przechodzi przez Krok 1b/3 (PROJECT/cortex-frontend-hub-
// db-driven-projekt.md): aktywacja jest świadomym krokiem operatora przez
// "Dodaj aplikację" (system-config), nie automatycznym skutkiem merge'a kodu.
export const documentParserTile = defineTile({
  id: "document-parser",
  kind: "native",
  label: "Parser Dokumentów",
  entitlementCode: "document-parser",
  route: "/document-parser/upload",
})
