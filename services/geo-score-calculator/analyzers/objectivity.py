"""Analyzer: obiektywność tekstu.

Port of geo_calc/app/backend/analyzers/objectivity.py, with one behavioral
change required by the /analyze contract (PROJECT/cortex-frontend-geo-score-
calculator-port-projekt.md §3): `foundWords` now carries `position` per
OCCURRENCE (needed for inline highlighting), not a deduplicated list of
matched word strings. `subjectiveCount`/`subjectiveRatio` are unchanged in
meaning (they already counted every occurrence, not unique words — see
`test_found_words_all_occurrences_with_position` in
tests/test_objectivity_analyzer.py for the parity check against the
original's `subjective_count` semantics). Recommendations still come from the
deduplicated, first-occurrence-ordered word list, exactly as before.
"""
import re
from typing import Optional

from constants import DEFAULT_SUBJECTIVE_WORDS

ALTERNATIVES = {
    "najlepszy": "wysoko oceniany",
    "najlepsza": "wysoko oceniana",
    "wyjątkowy": "charakterystyczny",
    "wyjątkowa": "charakterystyczna",
    "rewolucyjny": "nowy",
    "rewolucyjna": "nowa",
    "innowacyjny": "nowy, oparty na [konkretna technologia]",
    "lider": "jedna z czołowych firm",
    "unikalny": "jedyny na rynku oferujący [konkret]",
    "doskonały": "spełniający wymagania",
    "perfekcyjny": "zgodny ze specyfikacją",
}


def _normalize_word(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def _iter_words_with_positions(text: str):
    """Same tokenization as `text.split()` (split on whitespace runs), but
    keeps the character offset of each token — `text.split()` throws that
    away, which is exactly why the original PoC could never report a
    position for objectivity matches."""
    for match in re.finditer(r"\S+", text):
        yield match.group(), match.start()


def _generate_recommendations(found_words: list[str]) -> list[str]:
    recommendations = []
    for word in found_words[:5]:
        if word in ALTERNATIVES:
            recommendations.append(f"'{word}' → '{ALTERNATIVES[word]}'")
        else:
            recommendations.append(f"Rozważ usunięcie lub uzasadnienie: '{word}'")
    return recommendations


def analyze_objectivity(
    text: str,
    max_ratio: float = 0.05,
    subjective_words: Optional[set] = None,
) -> dict:
    if subjective_words is None:
        subjective_words = set(DEFAULT_SUBJECTIVE_WORDS)

    tokens = list(_iter_words_with_positions(text))
    word_count = len(tokens)

    if word_count == 0:
        return {
            "score": 100.0,
            "subjectiveCount": 0,
            "subjectiveRatio": 0.0,
            "foundWords": [],
            "recommendations": [],
        }

    occurrences: list[dict] = []
    unique_found: list[str] = []
    seen: set[str] = set()

    for word, position in tokens:
        normalized = _normalize_word(word)
        if normalized in subjective_words:
            occurrences.append({"value": normalized, "position": position})
            if normalized not in seen:
                seen.add(normalized)
                unique_found.append(normalized)

    subjective_count = len(occurrences)
    subjective_ratio = subjective_count / word_count

    if subjective_ratio <= max_ratio:
        score = 100 - (subjective_ratio / max_ratio) * 50
    else:
        excess = subjective_ratio - max_ratio
        score = max(0, 50 - (excess / max_ratio) * 50)

    return {
        "score": round(score, 1),
        "subjectiveCount": subjective_count,
        "subjectiveRatio": round(subjective_ratio, 4),
        "foundWords": occurrences,
        "recommendations": _generate_recommendations(unique_found),
    }
