import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("visual-guru") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Id UWOLNIONY 03.08.2026 (rename starego "Generatora
// prezentacji" na "presentation-generator", patrz commit 010ed5a i
// PROJECT/cortex-frontend-visual-guru-tile-projekt.md D8) — prerequisite tej
// zmiany, już zweryfikowany, nie duplikowany tu.
//
// Jeden poziom dostępu (D7, design doc §2) — Visual Guru nie ma koncepcji
// zasobu współdzielonego do zarządzania (brak szablonów/marki jak w
// Ilustromacie), więc brak osobnego scope'u.
//
// FAZA 0 (fundament): tylko ten manifest — zero page.tsx pod tym folderem
// jeszcze (Faza 1: generator, Faza 2: archiwum). `route` wskazuje na przyszły
// ekran generatora. Do pierwszej realnej aktywacji ten kod jest widoczny
// WYŁĄCZNIE jako nieaktywny kandydat w formularzu "Dodaj aplikację" —
// świadomie, wzorem geo-score-calculator/document-parser (seed-tile-manifests.mjs
// insertuje is_active=false, activated_at=null na pierwszym deployu).
export const visualGuruTile = defineTile({
  id: "visual-guru",
  kind: "native",
  label: "Visual Guru",
  entitlementCode: "visual-guru",
  route: "/visual-guru",
})
