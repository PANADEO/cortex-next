"""Full-stack test of POST /analyze: request validation, weighted total,
grade thresholds, and the exact response shape from the contract in
PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md §3.
"""
from fastapi.testclient import TestClient

from constants import (
    DEFAULT_ACTION_VERBS,
    DEFAULT_BULLET_PATTERNS,
    DEFAULT_FALSE_POSITIVES,
    DEFAULT_SUBJECTIVE_WORDS,
)
from main import app

client = TestClient(app)


def default_config() -> dict:
    """Mirrors DEFAULT_WEIGHTS/DEFAULT_BENCHMARKS/DEFAULT_GRADES in
    geo_calc/app/backend/constants.py — same defaults the seed script
    (packages/@cortex/db/scripts/seed-geo-score-calculator.mjs) inserts into
    Postgres, so this test payload matches what Next.js will actually send."""
    return {
        "weights": {
            "statistics": 0.30,
            "actionVerbs": 0.25,
            "structure": 0.20,
            "objectivity": 0.25,
        },
        "benchmarks": {
            "statsPer100Words": 4.0,
            "actionVerbRatio": 0.15,
            "bulletsPer500Words": 3.0,
            "maxSubjectiveRatio": 0.05,
        },
        "grades": {"aMin": 90, "bMin": 75, "cMin": 60, "dMin": 40},
        "actionVerbs": DEFAULT_ACTION_VERBS,
        "subjectiveWords": DEFAULT_SUBJECTIVE_WORDS,
        "falsePositives": DEFAULT_FALSE_POSITIVES,
        "bulletPatterns": DEFAULT_BULLET_PATTERNS,
    }


GOOD_TEXT = (
    "Firma wdrożyła nowy system i zwiększyła przychody o 35% w 2025 roku.\n\n"
    "Kluczowe wyniki:\n"
    "- przychód wzrósł o 150 mln PLN\n"
    "- liczba klientów podwoiła się\n"
    "- zespół uruchomił trzy nowe produkty\n\n"
    "Zarząd podpisał umowę z nr 3 partnerem na rynku i przekroczył plan o 12%."
)


def test_analyze_returns_full_contract_shape():
    response = client.post("/analyze", json={"text": GOOD_TEXT, **default_config()})
    assert response.status_code == 200
    body = response.json()

    assert set(body.keys()) == {
        "totalScore",
        "grade",
        "wordCount",
        "statistics",
        "actionVerbs",
        "structure",
        "objectivity",
        "recommendations",
    }
    assert body["grade"] in ("A", "B", "C", "D", "F")
    assert 0 <= body["totalScore"] <= 100
    assert body["wordCount"] == len(GOOD_TEXT.split())

    assert set(body["statistics"].keys()) == {"score", "count", "per100Words", "examples"}
    for example in body["statistics"]["examples"]:
        assert set(example.keys()) == {"value", "position"}

    assert set(body["actionVerbs"].keys()) == {
        "score", "actionVerbCount", "totalVerbCount", "ratio", "foundVerbs", "method",
    }
    assert body["actionVerbs"]["method"] in ("spacy", "heuristic")

    assert set(body["structure"].keys()) == {
        "score", "bulletCount", "per500Words", "hasHeaders", "paragraphCount",
    }

    assert set(body["objectivity"].keys()) == {"score", "subjectiveCount", "subjectiveRatio", "foundWords"}
    for match in body["objectivity"]["foundWords"]:
        assert set(match.keys()) == {"value", "position"}


def test_analyze_total_score_is_weighted_sum():
    response = client.post("/analyze", json={"text": GOOD_TEXT, **default_config()})
    body = response.json()

    expected = round(
        body["statistics"]["score"] * 0.30
        + body["actionVerbs"]["score"] * 0.25
        + body["structure"]["score"] * 0.20
        + body["objectivity"]["score"] * 0.25,
        1,
    )
    assert body["totalScore"] == expected


def test_analyze_empty_text():
    # Faithful to the original: stats/actionVerbs/structure all score 0 for
    # empty text, but objectivity scores an empty text 100 ("zero subjective
    # words found" == "perfectly objective") — see analyzers/objectivity.py's
    # empty-text branch, ported unchanged from geo_calc. Weighted total is
    # therefore 100 * objectivity weight (0.25 by default), not 0.
    response = client.post("/analyze", json={"text": "", **default_config()})
    body = response.json()
    assert body["totalScore"] == 25.0
    assert body["grade"] == "F"
    assert body["wordCount"] == 0


def test_analyze_subjective_marketing_text_scores_lower_than_data_driven_text():
    marketing_text = "Nasz najlepszy, wyjątkowy i rewolucyjny produkt jest absolutnie doskonały."
    response = client.post("/analyze", json={"text": marketing_text, **default_config()})
    marketing_score = response.json()["totalScore"]

    response = client.post("/analyze", json={"text": GOOD_TEXT, **default_config()})
    data_driven_score = response.json()["totalScore"]

    assert data_driven_score > marketing_score


def test_analyze_missing_field_is_rejected():
    payload = default_config()
    del payload["weights"]
    response = client.post("/analyze", json={"text": GOOD_TEXT, **payload})
    assert response.status_code == 422


def test_analyze_custom_config_changes_result():
    text = "50% wzrost, 100 mln PLN przychodu, rok 2025."
    config = default_config()
    response_default = client.post("/analyze", json={"text": text, **config})

    config["benchmarks"]["statsPer100Words"] = 100.0
    response_harder = client.post("/analyze", json={"text": text, **config})

    assert (
        response_harder.json()["statistics"]["score"]
        < response_default.json()["statistics"]["score"]
    )
