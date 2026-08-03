// Pomocnik dla `row(substring)` POM-ów list opartych o `getByRole("row", {
// name: new RegExp(...) })` (wzorem DocumentParserHistoryPage/
// VisualGuruHistoryPage) — bez ucieczki metaznaków regexu, dowolny
// substring zawierający np. nawiasy (`"X (zmieniony)"`, zwykła konwencja
// nazewnictwa w testach edycji tego repo) łamie dopasowanie po cichu:
// `new RegExp("X (zmieniony)").test("X (zmieniony)")` === false, bo
// `(zmieniony)` parsuje się jako grupa przechwytująca, nie dosłowny tekst.
// Znalezione i zreprodukowane w Content Guru Round E (03.08.2026).

export function rowMatchPattern(substring: string): RegExp {
  return new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
}
