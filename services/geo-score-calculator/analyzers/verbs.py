"""Analyzer: czasowniki akcji.

1:1 port of geo_calc/app/backend/analyzers/verbs.py — spaCy POS-tagging
(`pl_core_news_sm`) with an AUTOMATIC fallback to the ending-based heuristic
when the model can't load. This is not a test-only code path: it is the same
production fallback the original Streamlit app exposed (`method` field,
"spaCy / heurystyka" in the PoC's UI). D2 Option A (PROJECT/cortex-frontend-
geo-score-calculator-port-projekt.md) keeps spaCy for quality, but the
fallback stays wired exactly as-is — the Dockerfile guarantees the model IS
present in this image (build-time `spacy download`), so in production this
service should always report `method: "spacy"`; the heuristic path exists
for local/test environments without the model installed.
"""
import re
from typing import Optional

from constants import DEFAULT_ACTION_VERBS, DEFAULT_FALSE_POSITIVES

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False

_nlp_model = None

NOUN_ENDINGS = {
    "anie", "enie", "cie",
    "ość", "ność",
    "acja", "kcja",
    "stwo", "ctwo",
    "nik", "nica",
    "ek", "ka", "ko",
    "ota",
}

VERB_ENDINGS = [
    "ał", "ała", "ali", "ały",
    "ił", "iła", "ili", "iły",
    "ył", "yła", "yli", "yły",
    "ował", "owała", "owali", "owały",
    "uje", "ują",
    "a", "ą",
    "ie", "i",
]


def _get_spacy_model():
    global _nlp_model
    if _nlp_model is None and SPACY_AVAILABLE:
        try:
            _nlp_model = spacy.load("pl_core_news_sm")
        except OSError:
            pass
    return _nlp_model


def _normalize_word(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def _is_action_verb(
    word: str,
    lemma: Optional[str] = None,
    action_verbs: Optional[set] = None,
    false_positives: Optional[set] = None,
) -> bool:
    if action_verbs is None:
        action_verbs = set(DEFAULT_ACTION_VERBS)
    if false_positives is None:
        false_positives = set(DEFAULT_FALSE_POSITIVES)

    normalized = _normalize_word(word)
    lemma_normalized = _normalize_word(lemma) if lemma else None

    if normalized in false_positives:
        return False

    for ending in NOUN_ENDINGS:
        if normalized.endswith(ending):
            return False

    if normalized in action_verbs:
        return True
    if lemma_normalized and lemma_normalized in action_verbs:
        return True

    for action_verb in action_verbs:
        if len(normalized) >= 7 and len(action_verb) >= 7:
            if normalized[:7] == action_verb[:7]:
                return True
        if lemma_normalized and len(lemma_normalized) >= 7 and len(action_verb) >= 7:
            if lemma_normalized[:7] == action_verb[:7]:
                return True

    return False


def _analyze_with_spacy(
    text: str,
    benchmark: float,
    action_verbs: Optional[set] = None,
    false_positives: Optional[set] = None,
) -> dict:
    nlp = _get_spacy_model()
    doc = nlp(text)

    all_verbs = []
    action_verbs_found = []
    seen_lemmas = set()

    for token in doc:
        if token.pos_ in ("VERB", "AUX"):
            all_verbs.append(token.text)
            if _is_action_verb(token.text, token.lemma_, action_verbs, false_positives):
                lemma = _normalize_word(token.lemma_)
                if lemma not in seen_lemmas:
                    seen_lemmas.add(lemma)
                    action_verbs_found.append(lemma)

    total_verb_count = len(all_verbs)
    action_verb_count = len([
        v for v in all_verbs
        if _is_action_verb(v, action_verbs=action_verbs, false_positives=false_positives)
    ])

    ratio = action_verb_count / total_verb_count if total_verb_count > 0 else 0
    score = min(100, (ratio / benchmark) * 100)

    return {
        "score": round(score, 1),
        "actionVerbCount": action_verb_count,
        "totalVerbCount": total_verb_count,
        "ratio": round(ratio, 3),
        "foundVerbs": action_verbs_found[:10],
        "method": "spacy",
    }


def _could_be_verb(word: str) -> bool:
    word = _normalize_word(word)
    if len(word) < 3:
        return False
    return any(word.endswith(ending) for ending in VERB_ENDINGS)


def _analyze_with_heuristic(
    text: str,
    benchmark: float,
    action_verbs: Optional[set] = None,
    false_positives: Optional[set] = None,
) -> dict:
    words = text.split()

    if not words:
        return {
            "score": 0.0,
            "actionVerbCount": 0,
            "totalVerbCount": 0,
            "ratio": 0.0,
            "foundVerbs": [],
            "method": "heuristic",
        }

    potential_verbs = [w for w in words if _could_be_verb(w)]
    found = []
    seen = set()

    for word in words:
        if _is_action_verb(word, action_verbs=action_verbs, false_positives=false_positives):
            normalized = _normalize_word(word)
            if normalized not in seen:
                seen.add(normalized)
                found.append(normalized)

    action_count = len([
        w for w in words
        if _is_action_verb(w, action_verbs=action_verbs, false_positives=false_positives)
    ])
    potential_count = len(potential_verbs) if potential_verbs else 1

    ratio = action_count / potential_count if potential_count > 0 else 0
    score = min(100, (ratio / benchmark) * 100)

    return {
        "score": round(score, 1),
        "actionVerbCount": action_count,
        "totalVerbCount": potential_count,
        "ratio": round(ratio, 3),
        "foundVerbs": found[:10],
        "method": "heuristic",
    }


def analyze_action_verbs(
    text: str,
    benchmark: float = 0.15,
    action_verbs: Optional[set] = None,
    false_positives: Optional[set] = None,
) -> dict:
    nlp = _get_spacy_model()
    if nlp is not None:
        return _analyze_with_spacy(text, benchmark, action_verbs, false_positives)
    return _analyze_with_heuristic(text, benchmark, action_verbs, false_positives)


def is_spacy_available() -> bool:
    return _get_spacy_model() is not None
