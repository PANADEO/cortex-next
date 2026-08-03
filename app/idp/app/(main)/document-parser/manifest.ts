import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("document-parser") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Sprawdzony grepem przed nazwaniem — brak kolizji z
// istniejącymi kafelkami (code-tile "Znane kolizje nazw").
//
// route wskazuje na Fazę 3 (3 ekrany FE, D1) — jeszcze nie zbudowaną w tym
// repo. To zamierzone: seed-tile-manifests.mjs rejestruje ten kod jako
// NIEAKTYWNEGO kandydata (is_active=false, show_on_hub=false) w "Dodaj
// aplikację" już teraz (Faza 0/1), zanim strony pod tym route'em istnieją —
// dokładnie ten sam mechanizm, którym każdy inny natywny kafelek przechodzi
// przez Krok 1b/3, patrz PROJECT/cortex-frontend-hub-db-driven-projekt.md.
// Aktywacja (i sama strona) czeka na Fazę 2/3.
export const documentParserTile = defineTile({
  id: "document-parser",
  kind: "native",
  label: "Parser Dokumentów",
  entitlementCode: "document-parser",
  route: "/document-parser/upload",
})
