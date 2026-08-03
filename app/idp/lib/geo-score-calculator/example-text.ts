// Treść dla przycisku "Wczytaj przykład" w pustym stanie kalkulatora
// (PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md §7 pkt 5 —
// JEDEN przycisk z przykładem, nie dwa demo-owe "dobry/zły" jak w PoC).
//
// Świadomie tekst z DUŻĄ liczbą danych/czasowników akcji, bullet-listą i BEZ
// słów z DEFAULT_SUBJECTIVE_WORDS (packages/@cortex/db/scripts/seed-geo-
// score-calculator.mjs) — ma demonstrować, jak wygląda tekst wysoko
// oceniony, nie służyć jako test regresji algorytmu.
export const EXAMPLE_TEXT = `Grupa Panadeo wdrożyła nowy system analityczny w trzecim kwartale 2026 roku, zwiększając efektywność przetwarzania danych o 42%. Firma zainwestowała 12 mln PLN w rozwój infrastruktury chmurowej i zautomatyzowała kluczowe procesy raportowania.

W wyniku wdrożenia liczba błędów manualnych spadła o 68%, a czas realizacji zamówień skrócił się z 5 dni do 2 dni. Zespół opracował trzy nowe moduły integracyjne, które połączyły dane z 15 systemów zewnętrznych.

Kluczowe rezultaty:
- Przychody wzrosły o 23% rok do roku
- Liczba klientów zwiększyła się do 340 firm
- Zespół rozwinął się z 12 do 28 osób

Zarząd ogłosił, że w 2027 roku planuje rozszerzyć działalność na trzy nowe rynki europejskie.`
