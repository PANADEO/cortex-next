import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("ilustromat") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Warstwa granularna (kto zarządza szablonami marki)
// idzie przez scope "manage-templates", nie przez osobny kafelek.
//
// K2: wartości prezentacyjne niżej odczytane 08.08.2026 z bazy `cortex`, nie
// przeniesione z APPLICATIONS — tego kodu tam nigdy nie było (patrz komentarz
// w app/idp/app/(main)/document-parser/manifest.ts po pełne uzasadnienie).
//
// Tu jednak, inaczej niż tam, wartości MAJĄ dziś drugie źródło w repo:
// identyczną piątkę zapisuje UPDATE w packages/@cortex/db/scripts/
// seed-ilustromat.mjs (razem z aktywacją kafelka). Kopia zostaje świadomie i
// jest tymczasowa: tamten UPDATE stoi pod `where activated_at is null`, więc
// na bazie, gdzie wiersz powstał PRZED K2 (kolumny NULL, kafelek jeszcze
// nieaktywowany), INSERT z manifestu już się nie wykona i jedyne, co wypełni
// opis i ikonę, to właśnie ten UPDATE. Usunięcie go teraz cofnęłoby te
// instancje do stanu "karta na hubie bez opisu", czyli defektu z 254b704.
// Kandydat do likwidacji w K3, razem z resztą sprzątania seedów.
export const ilustromatTile = defineTile({
  id: "ilustromat",
  kind: "native",
  label: "Ilustromat",
  entitlementCode: "ilustromat",
  route: "/ilustromat/generation",
  description: "Generuje brandowane grafiki do postów LinkedIn z szablonów marki",
  icon: "Image",
  color: "violet",
  categoryFunctional: "content-generation",
  categoryDepartment: ["marketing"],
})
