// Górna granica długości tekstu do analizy — JEDNA stała, dzielona między
// walidację Zod na kontrolerze (app/api/geo-score-calculator/analyze) i UI
// (licznik znaków, `maxLength` na Textarze w trybie edycji), zamiast dwóch
// liczb, które mogłyby się rozjechać.
//
// 40 000 znaków ≈ 6-7 tys. słów — hojny margines dla artykułu prasowego
// (dziedzina tego narzędzia), wystarczający żeby nie ograniczać realnego
// użycia, ale skończony (ochrona przed nadużyciem/omyłkowym wklejeniem
// całego dokumentu zamiast jednego tekstu).
export const TEXT_MAX_CHARS = 40_000
