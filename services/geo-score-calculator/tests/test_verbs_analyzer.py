"""Port of geo_calc/app/tests/test_verbs_analyzer.py, adapted to the
dict-with-camelCase-keys shape. `method` is asserted to be either "spacy" or
"heuristic" because this test suite may run outside the Docker image (where
`pl_core_news_sm` is guaranteed present) — e.g. local `pytest` without the
model installed exercises the heuristic fallback, which is the same
production code path, just the other legal branch (see analyzers/verbs.py
docstring). The real image is verified separately to always resolve to
"spacy" — see the implementation report.
"""
from analyzers.verbs import _is_action_verb, _normalize_word, analyze_action_verbs


class TestVerbsAnalyzer:

    def test_empty_text(self):
        result = analyze_action_verbs("")
        assert result["score"] == 0
        assert result["actionVerbCount"] == 0

    def test_finds_action_verbs(self):
        text = "Firma wdrożyła nowy system i uruchomiła platformę"
        result = analyze_action_verbs(text)
        assert result["actionVerbCount"] > 0

    def test_no_action_verbs(self):
        text = "To jest tekst bez czasowników akcji jako taki"
        result = analyze_action_verbs(text)
        assert result["actionVerbCount"] == 0

    def test_false_positives_excluded(self):
        assert not _is_action_verb("rozwiązania")
        assert not _is_action_verb("wdrożenie")
        assert not _is_action_verb("uruchomienie")

    def test_direct_match(self):
        verbs = {"wdrożył", "uruchomił"}
        assert _is_action_verb("wdrożył", action_verbs=verbs, false_positives=set())

    def test_stem_matching(self):
        verbs = {"wdrożył"}
        # "wdrożyła" shares 7-char prefix with "wdrożył"
        assert _is_action_verb("wdrożyła", action_verbs=verbs, false_positives=set())

    def test_method_field(self):
        result = analyze_action_verbs("Firma wdrożyła system")
        assert result["method"] in ("spacy", "heuristic")

    def test_custom_action_verbs(self):
        custom_verbs = {"testował", "walidował"}
        text = "Zespół testował i walidował moduły"
        result = analyze_action_verbs(text, action_verbs=custom_verbs, false_positives=set())
        assert result["actionVerbCount"] > 0

    def test_custom_benchmark(self):
        text = "Firma wdrożyła i uruchomiła system"
        r1 = analyze_action_verbs(text, benchmark=0.05)
        r2 = analyze_action_verbs(text, benchmark=0.50)
        assert r1["score"] >= r2["score"]

    def test_normalize_word(self):
        assert _normalize_word("Wdrożył!") == "wdrożył"
        assert _normalize_word("(test)") == "test"
