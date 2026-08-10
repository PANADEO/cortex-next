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
//
// K2, POŁOWA MANIFEST-ONLY — skąd wzięły się `description`/`icon` niżej.
// Ten kod nigdy nie był w APPLICATIONS (seed-system-config.mjs), więc nie ma
// czego z niej przenosić. Jego wartości żyły dotąd WYŁĄCZNIE w bazie: wpisały
// je ręcznymi UPDATE-ami commity 254b704 (opisy) i ee351cc (ikony), bo seed
// manifestowy zostawiał tu NULL. Odczytane 08.08.2026 z instancji `cortex`
// i przeniesione tutaj co do znaku — bez tego K3 zostawiłby ten kafelek na
// ŚWIEŻEJ instalacji bez opisu i z generycznym LayoutDashboard, czyli
// odtworzył dokładnie ten stan, który tamte dwa commity naprawiały ręcznie.
//
// UWAGA dla czytelnika, który zechce to zweryfikować: app/idp/lib/tiles.ts ma
// dla tego kafelka INNY opis ("Ekstrakcja treści dokumentów (PDF, Office,
// obrazy) do ustrukturyzowanego Markdown") i inne kategorie. Rozjazd jest
// stanem zastanym; źródłem jest baza, bo to ona zasila hub. Uzgodnienie obu
// rejestrów należy do kroku likwidującego tiles.ts (D6), nie do K2, który ma
// być przenosinami bez zmiany treści.
//
// Zmierzone przy review K2: tiles.ts rozjeżdża się z bazą na opisie dla
// WSZYSTKICH PIĘCIU kafelków manifest-only, nie tylko dla tych trzech, które
// różnią się też kolorem albo kategorią. Skala rozjazdu jest więc większa, niż
// wynikałoby z samej listy różnic w kolumnach — warto o tym pamiętać przy D6.
//
// `color`/`categoryFunctional`/`categoryDepartment` są w bazie NULL i zostają
// pominięte — wartości nie ma, więc nie ma czego przenieść. Wymyślenie jej
// tutaj (np. z tiles.ts) byłoby zmianą prezentacji przemyconą w migracji.
// Ten sam przypadek co visual-guru.
export const documentParserTile = defineTile({
  id: "document-parser",
  kind: "native",
  label: "Parser Dokumentów",
  entitlementCode: "document-parser",
  route: "/document-parser/upload",
  description: "Wyciąga ustrukturyzowaną treść z dokumentów PDF, Office i obrazów",
  icon: "FileScan",
})
