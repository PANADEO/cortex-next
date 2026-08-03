"""Port of geo_calc/app/tests/test_stats_analyzer.py, adapted to the
dict-with-camelCase-keys shape this service's analyzer returns instead of the
original NamedTuple."""
from analyzers.stats import analyze_statistics


class TestStatsAnalyzer:

    def test_empty_text(self):
        result = analyze_statistics("")
        assert result["score"] == 0
        assert result["count"] == 0

    def test_percentages(self):
        result = analyze_statistics("Wzrost o 35% i 18 proc. w Q4")
        assert result["count"] >= 2
        assert any("35%" in ex["value"] for ex in result["examples"])

    def test_amounts(self):
        result = analyze_statistics("Przychód 150 mln PLN i 25 mld zł")
        assert result["count"] >= 2

    def test_years(self):
        result = analyze_statistics("W roku 2024 i 2025 firma rosła")
        assert result["count"] >= 2

    def test_large_numbers(self):
        result = analyze_statistics("Zatrudniamy 1 000 000 osób i 50 000 partnerów")
        assert result["count"] >= 2

    def test_units(self):
        result = analyze_statistics("Budynek 50 m2 i farma 100 MW")
        assert result["count"] >= 2

    def test_multipliers(self):
        result = analyze_statistics("Wzrost 3x i dwukrotnie lepiej")
        assert result["count"] >= 2

    def test_rankings(self):
        result = analyze_statistics("Firma zajmuje miejsce 1 i jest nr 3")
        assert result["count"] >= 2

    def test_high_density_gives_high_score(self):
        text = "Wynik 50%, przychód 100 mln PLN, rok 2025, ranking nr 1, wzrost 3x " * 5
        result = analyze_statistics(text)
        assert result["score"] >= 80

    def test_no_stats_gives_zero(self):
        result = analyze_statistics("To jest tekst bez żadnych danych liczbowych ani statystyk")
        assert result["score"] == 0
        assert result["count"] == 0

    def test_custom_benchmark(self):
        text = "To jest tekst z jedną statystyką 50% pośród wielu słów bez danych liczbowych"
        r1 = analyze_statistics(text, benchmark=2.0)
        r2 = analyze_statistics(text, benchmark=20.0)
        assert r1["score"] > r2["score"]

    def test_no_double_counting(self):
        result = analyze_statistics("150 mln PLN")
        assert result["count"] == 1

    def test_examples_limited_to_5(self):
        text = "1%, 2%, 3%, 4%, 5%, 6%, 7%, 8%, 9%, 10% to wartości"
        result = analyze_statistics(text)
        assert len(result["examples"]) <= 5

    def test_examples_carry_position(self):
        text = "To jest tekst z jedną statystyką 30% w środku zdania"
        result = analyze_statistics(text)
        match = next(ex for ex in result["examples"] if ex["value"] == "30%")
        assert text[match["position"] : match["position"] + len(match["value"])] == "30%"
