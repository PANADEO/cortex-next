"""Pydantic request/response schemas — 1:1 with the POST /analyze contract in
PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md §3. Field names
are deliberately camelCase (unlike the rest of this Python service) because
this IS the wire contract with Next.js, not an internal API — matching it
exactly avoids a translation layer on either side.

The request is the FULL config snapshot (weights/benchmarks/grades/word
lists) — every field is required, nothing defaults server-side. The service
is stateless (D3): if Next.js sends an incomplete payload, this should fail
loudly (422) rather than silently substituting a stale or wrong default.
"""
from pydantic import BaseModel


class WeightsIn(BaseModel):
    statistics: float
    actionVerbs: float
    structure: float
    objectivity: float


class BenchmarksIn(BaseModel):
    statsPer100Words: float
    actionVerbRatio: float
    bulletsPer500Words: float
    maxSubjectiveRatio: float


class GradesIn(BaseModel):
    aMin: int
    bMin: int
    cMin: int
    dMin: int


class AnalyzeRequest(BaseModel):
    text: str
    weights: WeightsIn
    benchmarks: BenchmarksIn
    grades: GradesIn
    actionVerbs: list[str]
    subjectiveWords: list[str]
    falsePositives: list[str]
    bulletPatterns: list[str]


class PositionedMatch(BaseModel):
    """A found term plus its character offset in the source text — used for
    inline highlighting in the (future) calculator UI."""

    value: str
    position: int


class StatisticsOut(BaseModel):
    score: float
    count: int
    per100Words: float
    examples: list[PositionedMatch]


class ActionVerbsOut(BaseModel):
    score: float
    actionVerbCount: int
    totalVerbCount: int
    ratio: float
    foundVerbs: list[str]
    method: str


class StructureOut(BaseModel):
    score: float
    bulletCount: int
    per500Words: float
    hasHeaders: bool
    paragraphCount: int


class ObjectivityOut(BaseModel):
    score: float
    subjectiveCount: int
    subjectiveRatio: float
    foundWords: list[PositionedMatch]


class AnalyzeResponse(BaseModel):
    totalScore: float
    grade: str
    wordCount: int
    statistics: StatisticsOut
    actionVerbs: ActionVerbsOut
    structure: StructureOut
    objectivity: ObjectivityOut
    recommendations: list[str]
