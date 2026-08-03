"""Port of geo_calc/app/tests/test_objectivity_analyzer.py, adapted to the
dict-with-camelCase-keys shape AND to the intentional contract change:
`foundWords` is now every occurrence with its position, not a deduplicated
list of matched strings (see analyzers/objectivity.py docstring). Two tests
(`test_found_words`, `test_found_words_unique` in the original) are rewritten
below to assert the new, occurrence-level shape instead of silently
inheriting stale assumptions.
"""
from analyzers.objectivity import analyze_objectivity


class TestObjectivityAnalyzer:

    def test_empty_text(self):
        result = analyze_objectivity("")
        assert result["score"] == 100
        assert result["subjectiveCount"] == 0

    def test_objective_text(self):
        text = "Firma zatrudnia 500 osób i działa w 3 krajach"
        result = analyze_objectivity(text)
        assert result["score"] >= 90
        assert result["subjectiveCount"] == 0

    def test_subjective_text(self):
        text = "Nasza firma jest najlepsza i wyjątkowa na rynku doskonała"
        result = analyze_objectivity(text)
        assert result["subjectiveCount"] >= 3
        assert result["score"] < 80

    def test_found_words_values(self):
        text = "To jest najlepszy i rewolucyjny produkt na rynku"
        result = analyze_objectivity(text)
        values = [item["value"] for item in result["foundWords"]]
        assert "najlepszy" in values
        assert "rewolucyjny" in values

    def test_recommendations_generated(self):
        text = "Nasz najlepszy i wyjątkowy produkt"
        result = analyze_objectivity(text)
        assert len(result["recommendations"]) > 0

    def test_high_ratio_gives_low_score(self):
        text = "najlepszy wyjątkowy rewolucyjny doskonały niesamowity"
        result = analyze_objectivity(text)
        assert result["score"] < 30

    def test_custom_max_ratio(self):
        text = "To najlepszy produkt na rynku dzisiaj"
        r1 = analyze_objectivity(text, max_ratio=0.01)
        r2 = analyze_objectivity(text, max_ratio=0.50)
        assert r1["score"] < r2["score"]

    def test_custom_subjective_words(self):
        custom = {"specjalny", "super"}
        text = "To jest specjalny i super produkt"
        result = analyze_objectivity(text, subjective_words=custom)
        assert result["subjectiveCount"] >= 2

    def test_score_between_0_and_100(self):
        text = "najlepszy " * 100
        result = analyze_objectivity(text)
        assert 0 <= result["score"] <= 100

    def test_found_words_all_occurrences_with_position(self):
        # Contract change vs. geo_calc: foundWords is occurrence-level (one
        # entry per match, each with its own position), not deduplicated —
        # required so the UI can highlight every instance, not just the
        # first. subjectiveCount already counted occurrences in the original
        # too (unchanged semantics).
        text = "najlepszy najlepszy najlepszy produkt"
        result = analyze_objectivity(text)
        assert len(result["foundWords"]) == 3
        assert all(item["value"] == "najlepszy" for item in result["foundWords"])
        assert result["subjectiveCount"] == 3

    def test_found_words_position_matches_text_offset(self):
        text = "To jest najlepszy produkt na rynku"
        result = analyze_objectivity(text)
        match = result["foundWords"][0]
        assert text[match["position"] : match["position"] + len(match["value"])] == match["value"]
