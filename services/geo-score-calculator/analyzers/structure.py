"""Analyzer: struktura tekstu.

1:1 port of geo_calc/app/backend/analyzers/structure.py — bullet detection,
header heuristics, paragraph counting, and the +10/+10 bonus, unchanged.
"""
import re
from typing import Optional

from constants import DEFAULT_BULLET_PATTERNS


def _count_bullets(text: str, bullet_patterns: Optional[list[str]] = None) -> int:
    if bullet_patterns is None:
        bullet_patterns = DEFAULT_BULLET_PATTERNS

    count = 0
    for line in text.split("\n"):
        for pattern in bullet_patterns:
            if re.match(pattern, line):
                count += 1
                break
    return count


def _has_headers(text: str) -> bool:
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if re.match(r"^#{1,3}\s+", line):
            return True
        if line.isupper() and 3 < len(line) < 60:
            return True
        if line.endswith(":") and len(line) < 50:
            return True
    return False


def _count_paragraphs(text: str) -> int:
    paragraphs = re.split(r"\n\s*\n", text.strip())
    return len([p for p in paragraphs if p.strip()])


def analyze_structure(
    text: str,
    benchmark: float = 3.0,
    bullet_patterns: Optional[list[str]] = None,
) -> dict:
    words = text.split()
    word_count = len(words)

    if word_count == 0:
        return {
            "score": 0.0,
            "bulletCount": 0,
            "per500Words": 0.0,
            "hasHeaders": False,
            "paragraphCount": 0,
        }

    bullet_count = _count_bullets(text, bullet_patterns)
    per_500_words = (bullet_count / word_count) * 500

    has_headers = _has_headers(text)
    paragraph_count = _count_paragraphs(text)

    bullet_score = min(100, (per_500_words / benchmark) * 100)

    bonus = 0
    if has_headers:
        bonus += 10
    if paragraph_count >= 3:
        bonus += 10

    score = min(100, bullet_score + bonus)

    return {
        "score": round(score, 1),
        "bulletCount": bullet_count,
        "per500Words": round(per_500_words, 2),
        "hasHeaders": has_headers,
        "paragraphCount": paragraph_count,
    }
