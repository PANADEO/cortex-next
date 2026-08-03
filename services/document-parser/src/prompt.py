# One built-in prompt in v1 (design doc Q5 — prompt editability is an
# explicit, deliberately deferred Faza 2 extension, not a blocker: YAGNI).
# Legacy's full PromptRegistry class (multi-file registry with name/
# description lookup, ~/REPO/cortex-document-parser/src/core/prompt_registry.py)
# is overkill for exactly one, never-swapped prompt — this loads the same
# JSON content (unchanged) with the minimum code that does that.
from __future__ import annotations

import json
from pathlib import Path

_PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "document_extraction.json"


def _load_default_prompt() -> str:
    data = json.loads(_PROMPT_PATH.read_text(encoding="utf-8"))
    return str(data["content"])


DEFAULT_PROMPT = _load_default_prompt()
