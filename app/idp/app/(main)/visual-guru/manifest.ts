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
// FAZA 1 (generator): `./page.tsx` pod tym folderem to ekran generatora
// (design doc §6.1). Faza 2 (archiwum, `/visual-guru/history`) nie jest
// jeszcze zbudowana. `route` wskazuje na ekran generatora. Do pierwszej
// realnej aktywacji ten kod jest widoczny WYŁĄCZNIE jako nieaktywny kandydat
// w formularzu "Dodaj aplikację" — świadomie, wzorem
// geo-score-calculator/document-parser (seed-tile-manifests.mjs insertuje
// is_active=false, activated_at=null na pierwszym deployu).
//
// K2: `description`/`icon` niżej odczytane 08.08.2026 z bazy `cortex`, nie
// przeniesione z APPLICATIONS — tego kodu tam nigdy nie było. Pełne
// uzasadnienie (łącznie z tym, czemu tiles.ts mówi co innego i czemu
// color/kategorie zostają pominięte, bo w bazie są NULL): komentarz w
// app/idp/app/(main)/document-parser/manifest.ts, ten sam przypadek.
export const visualGuruTile = defineTile({
  id: "visual-guru",
  kind: "native",
  label: "Visual Guru",
  entitlementCode: "visual-guru",
  route: "/visual-guru",
  description: "Generuje obrazy AI ze swobodnego promptu i obrazu referencyjnego",
  icon: "Wand2",
})
