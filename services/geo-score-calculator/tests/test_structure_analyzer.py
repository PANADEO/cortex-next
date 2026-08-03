"""Port of geo_calc/app/tests/test_structure_analyzer.py, adapted to the
dict-with-camelCase-keys shape."""
from analyzers.structure import analyze_structure


class TestStructureAnalyzer:

    def test_empty_text(self):
        result = analyze_structure("")
        assert result["score"] == 0
        assert result["bulletCount"] == 0

    def test_bullet_dash(self):
        text = "Lista:\n- punkt pierwszy\n- punkt drugi\n- punkt trzeci"
        result = analyze_structure(text)
        assert result["bulletCount"] == 3

    def test_bullet_dot(self):
        text = "Lista:\n• punkt pierwszy\n• punkt drugi"
        result = analyze_structure(text)
        assert result["bulletCount"] == 2

    def test_numbered_list(self):
        text = "Lista:\n1. punkt\n2. punkt\n3. punkt"
        result = analyze_structure(text)
        assert result["bulletCount"] == 3

    def test_lettered_list(self):
        text = "Lista:\na. punkt\nb. punkt"
        result = analyze_structure(text)
        assert result["bulletCount"] == 2

    def test_markdown_headers(self):
        text = "# Nagłówek\n\nTekst akapitu."
        result = analyze_structure(text)
        assert result["hasHeaders"] is True

    def test_caps_headers(self):
        text = "WYNIKI FINANSOWE\n\nTekst pod nagłówkiem."
        result = analyze_structure(text)
        assert result["hasHeaders"] is True

    def test_colon_headers(self):
        text = "Kluczowe wyniki:\n\nOpis wyników firmy."
        result = analyze_structure(text)
        assert result["hasHeaders"] is True

    def test_no_headers(self):
        text = "To jest zwykły tekst bez nagłówków."
        result = analyze_structure(text)
        assert result["hasHeaders"] is False

    def test_paragraph_counting(self):
        text = "Akapit 1.\n\nAkapit 2.\n\nAkapit 3."
        result = analyze_structure(text)
        assert result["paragraphCount"] == 3

    def test_bonus_for_headers_and_paragraphs(self):
        text = "# Nagłówek\n\nAkapit 1.\n\nAkapit 2.\n\nAkapit 3."
        result = analyze_structure(text)
        assert result["score"] >= 20

    def test_custom_bullet_patterns(self):
        text = ">> punkt\n>> punkt"
        custom = [r"^>>\s+"]
        result = analyze_structure(text, bullet_patterns=custom)
        assert result["bulletCount"] == 2

    def test_score_capped_at_100(self):
        text = "# Header\n\nP1\n\nP2\n\nP3\n\n" + "\n".join(f"- item {i}" for i in range(50))
        result = analyze_structure(text)
        assert result["score"] <= 100
