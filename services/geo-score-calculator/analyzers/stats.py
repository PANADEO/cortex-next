"""Analyzer: statystyki i dane liczbowe.

1:1 port of geo_calc/app/backend/analyzers/stats.py — same 9 regex patterns,
same overlap-suppression, same benchmark math. One addition: `examples` now
carries `position` alongside `value` (PROJECT/cortex-frontend-geo-score-
calculator-port-projekt.md §3) — the original already computed `position` per
match, it just never survived into the value returned to the caller. Needed
for inline highlighting in the future calculator UI (Faza 1, out of scope
here).
"""
import re

PATTERNS = [
    (r"\d+[,.]?\d*\s*(?:%|proc\.?|procent\w*)", "procent"),
    (r"\d+[,.]?\d*\s*(?:mln|mld|tys\.?|mil\.?)\s*(?:PLN|zł|złotych|EUR|euro|USD|dolarów)?", "kwota"),
    (r"\d{1,3}(?:[\s,]\d{3})+", "duża_liczba"),
    (r"\b20[0-3]\d\b", "rok"),
    (r"\d+[,.]?\d*\s*(?:km|m2|m²|ha|ton|kg|MW|GW|kWh|MWh)", "z_jednostką"),
    (r"\d+[,.]?\d*\s*(?:x|krotnie|-krotny|-krotna|-krotne)", "mnożnik"),
    (r"(?:dwu|trzy|cztero|pięcio)krotni?e?y?a?", "mnożnik_słowny"),
    (r"(?:#|nr\.?|numer|miejsce)\s*\d+", "ranking"),
    (r"\b\d{2,}\b", "liczba"),
]


def analyze_statistics(text: str, benchmark: float = 4.0) -> dict:
    words = text.split()
    word_count = len(words)

    if word_count == 0:
        return {"score": 0.0, "count": 0, "per100Words": 0.0, "examples": []}

    found_stats: list[dict] = []
    seen_positions: set[tuple[int, int]] = set()

    for pattern, stat_type in PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            start, end = match.span()
            if not any(
                start < seen_end and end > seen_start for seen_start, seen_end in seen_positions
            ):
                seen_positions.add((start, end))
                found_stats.append({"value": match.group().strip(), "type": stat_type, "position": start})

    count = len(found_stats)
    per_100_words = (count / word_count) * 100
    score = min(100, (per_100_words / benchmark) * 100)
    examples = [{"value": item["value"], "position": item["position"]} for item in found_stats[:5]]

    return {
        "score": round(score, 1),
        "count": count,
        "per100Words": round(per_100_words, 2),
        "examples": examples,
    }
