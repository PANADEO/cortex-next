#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["httpx"]
# ///
"""Web search CLI connector for Cortex Cowork - Perplexity API (sonar models).

Invoked by the cowork-runner as a CLI connector tool: the agent passes an
argument list, the runner injects PERPLEXITY_API_KEY into the environment
(resolved from the cortex-config credential store). Prints the grounded
answer followed by a numbered source list; exits non-zero with a clear
message on any failure so the agent can react.

The runner enforces a 60s tool timeout, so the slow "deep research" model is
deliberately not offered here.
"""

import argparse
import os
import sys

import httpx

API_URL = "https://api.perplexity.ai/chat/completions"
MODELS = ["sonar", "sonar-pro", "sonar-reasoning-pro"]
RECENCY = ["day", "week", "month", "year"]
REQUEST_TIMEOUT_S = 50


def main() -> int:
    parser = argparse.ArgumentParser(description="Web search with citations (Perplexity)")
    parser.add_argument("query", nargs="+", help="Search query")
    parser.add_argument("--model", choices=MODELS, default="sonar")
    parser.add_argument("--recency", choices=RECENCY, help="Only sources from this period")
    parser.add_argument(
        "--domains",
        help="Comma-separated domain filter; prefix a domain with '-' to exclude it",
    )
    parser.add_argument("--academic", action="store_true", help="Academic sources mode")
    parser.add_argument("--max-tokens", type=int, default=1500)
    args = parser.parse_args()

    api_key = os.environ.get("PERPLEXITY_API_KEY", "")
    if not api_key:
        print(
            "PERPLEXITY_API_KEY is not set. The connector's credential ref is missing "
            "or unresolved in the cortex-config credential store.",
            file=sys.stderr,
        )
        return 2

    query = " ".join(args.query)
    payload: dict = {
        "model": args.model,
        "messages": [
            {
                "role": "system",
                "content": "Be precise and factual. Always ground claims in the sources.",
            },
            {"role": "user", "content": query},
        ],
        "max_tokens": args.max_tokens,
        "temperature": 0.2,
    }
    if args.recency:
        payload["search_recency_filter"] = args.recency
    if args.domains:
        payload["search_domain_filter"] = [d.strip() for d in args.domains.split(",") if d.strip()]
    if args.academic:
        payload["search_mode"] = "academic"

    try:
        response = httpx.post(
            API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=REQUEST_TIMEOUT_S,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        print(f"Perplexity API error {error.response.status_code}: {error.response.text[:500]}", file=sys.stderr)
        return 1
    except httpx.HTTPError as error:
        print(f"Perplexity request failed: {error}", file=sys.stderr)
        return 1

    data = response.json()
    answer = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    citations = data.get("citations") or []

    print(answer.strip())
    if citations:
        print("\nSources:")
        for index, url in enumerate(citations, start=1):
            print(f"[{index}] {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
