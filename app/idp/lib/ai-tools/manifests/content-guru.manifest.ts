import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("content-guru") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). `id`/`entitlementCode` ZOSTAJĄ "content-guru" bez
// zmian (PROJECT/cortex-frontend-content-guru-full-port-projekt.md D1) —
// zachowuje istniejące granty RBAC, nie ma migracji uprawnień.
//
// Faza 10 (cutover, ten sam dokument): atomowa zamiana dokonana — usunięto
// "content-guru" z AI_TOOL_DEFINITIONS/AI_TOOL_APP_CODES
// (app/idp/lib/ai-tools/{registry,app-codes}.ts) i dodano LEGACY_REDIRECTS
// wpis /ai-tools/content-guru -> /content-guru (308) w middleware.ts. Kafelek
// na hubie i w sidebarze linkuje dziś do `route` z tego manifestu przez
// ręczny wpis w app/idp/lib/tiles.ts (patrz komentarz tam) — Rounds A-E
// zbudowały realny ekran pod /content-guru, więc stary, cienki
// buildContentPrompt()-owy tool jest w pełni wycofany, nie tylko przekierowany
// na pustkę.
export const contentGuruTile = defineTile({
  id: "content-guru",
  kind: "native",
  label: "Kreator treści",
  entitlementCode: "content-guru",
  route: "/content-guru",
  description: "Generuje treści marketingowe i redakcyjne",
  icon: "Sparkles",
  color: "violet",
  categoryFunctional: "content-generation",
  categoryDepartment: ["marketing", "hr", "operations"],
  sortOrder: 160,
})
