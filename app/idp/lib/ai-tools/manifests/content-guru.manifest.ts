import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("content-guru") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). `id`/`entitlementCode` ZOSTAJĄ "content-guru" bez
// zmian (PROJECT/cortex-frontend-content-guru-full-port-projekt.md D1) —
// zachowuje istniejące granty RBAC, nie ma migracji uprawnień.
//
// `route` wskazuje już docelową Fazę 1 ("/content-guru", własny folder poza
// AI Tools hub — kafelek dostaje własny model danych, patrz
// packages/@cortex/db/src/schema/content-guru.ts), ale ŻADNA strona pod tym
// adresem jeszcze nie istnieje w tej zmianie (Faza 0 = wyłącznie
// schemat+migracja+config, zero UI). Świadomie NIE usunięto jeszcze
// "content-guru" z AI_TOOL_DEFINITIONS/AiToolId (app/idp/lib/ai-tools/{registry,app-codes}.ts)
// i świadomie NIE dodano LEGACY_REDIRECTS wpisu /ai-tools/content-guru ->
// /content-guru w middleware.ts — kafelek na hubie linkuje dziś do
// `/ai-tools/${id}` z registry.ts (app/idp/lib/tiles.ts:aiToolTile()),
// NIEZALEŻNIE od tego pola `route` (które dziś zasila wyłącznie ten wiersz
// applications, martwe dla renderu huba dopóki hub-DB-driven-render Krok 3
// nie wystartuje). Dodanie 308 z /ai-tools/content-guru DZIŚ przekierowałoby
// żywy, działający kafelek (stary, cienki buildContentPrompt()) na pustą
// stronę (Faza 1 jeszcze nieistniejąca) — cutover obu (redirect + usunięcie
// z AI_TOOL_DEFINITIONS) ma się zdarzyć ATOMOWO, gdy /content-guru faktycznie
// zacznie renderować coś w miejsce starego narzędzia, nie wcześniej.
export const contentGuruTile = defineTile({
  id: "content-guru",
  kind: "native",
  label: "Kreator treści",
  entitlementCode: "content-guru",
  route: "/content-guru",
})
