"""Orchestration: runs the four analyzers, combines them into a weighted
total score + letter grade, and generates recommendations. Port of
`CalculatorService.analyze()` from geo_calc/app/backend/services/
calculator_service.py, minus persistence — this service is stateless (D3,
PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md): the config
snapshot arrives in full on every request, and the result is simply returned,
never saved. Next.js owns saving it to Postgres (Faza 1, out of scope here).
"""
from analyzers.objectivity import analyze_objectivity
from analyzers.stats import analyze_statistics
from analyzers.structure import analyze_structure
from analyzers.verbs import analyze_action_verbs
from models import (
    ActionVerbsOut,
    AnalyzeRequest,
    AnalyzeResponse,
    GradesIn,
    ObjectivityOut,
    StatisticsOut,
    StructureOut,
)


def _grade(score: float, grades: GradesIn) -> str:
    if score >= grades.aMin:
        return "A"
    if score >= grades.bMin:
        return "B"
    if score >= grades.cMin:
        return "C"
    if score >= grades.dMin:
        return "D"
    return "F"


def _recommendations(stats: dict, verbs: dict, structure: dict, objectivity: dict) -> list[str]:
    recommendations: list[str] = []

    if stats["score"] < 70:
        recommendations.append(
            "Dodaj więcej danych liczbowych: procenty, kwoty, "
            "wyniki, statystyki (cel: min. 4 na 100 słów)"
        )

    if verbs["score"] < 70:
        recommendations.append(
            "Użyj więcej czasowników akcji: 'wdrożył', 'uruchomił', "
            "'zwiększył', 'osiągnął' zamiast 'jest', 'ma', 'posiada'"
        )

    if structure["score"] < 70:
        if structure["bulletCount"] < 2:
            recommendations.append(
                "Dodaj bullet points lub listę numerowaną z kluczowymi informacjami"
            )
        if not structure["hasHeaders"]:
            recommendations.append("Rozważ dodanie śródtytułów dla lepszej czytelności")

    if objectivity["score"] < 70:
        recommendations.extend(objectivity["recommendations"][:2])

    return recommendations


def calculate_geo_score(payload: AnalyzeRequest) -> AnalyzeResponse:
    weights = payload.weights
    benchmarks = payload.benchmarks

    action_verbs = set(payload.actionVerbs)
    false_positives = set(payload.falsePositives)
    subjective_words = set(payload.subjectiveWords)

    stats = analyze_statistics(payload.text, benchmarks.statsPer100Words)
    verbs = analyze_action_verbs(
        payload.text,
        benchmarks.actionVerbRatio,
        action_verbs=action_verbs,
        false_positives=false_positives,
    )
    structure = analyze_structure(payload.text, benchmarks.bulletsPer500Words, payload.bulletPatterns)
    objectivity = analyze_objectivity(payload.text, benchmarks.maxSubjectiveRatio, subjective_words)

    total_score = round(
        stats["score"] * weights.statistics
        + verbs["score"] * weights.actionVerbs
        + structure["score"] * weights.structure
        + objectivity["score"] * weights.objectivity,
        1,
    )

    return AnalyzeResponse(
        totalScore=total_score,
        grade=_grade(total_score, payload.grades),
        wordCount=len(payload.text.split()),
        statistics=StatisticsOut(**stats),
        actionVerbs=ActionVerbsOut(**verbs),
        structure=StructureOut(**structure),
        objectivity=ObjectivityOut(
            score=objectivity["score"],
            subjectiveCount=objectivity["subjectiveCount"],
            subjectiveRatio=objectivity["subjectiveRatio"],
            foundWords=objectivity["foundWords"],
        ),
        recommendations=_recommendations(stats, verbs, structure, objectivity),
    )
