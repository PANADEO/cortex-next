#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["httpx"]
# ///
"""Web search CLI connector for Cortex Cowork - Perplexity sonar models via cortex-proxy.

Invoked by the cowork-runner as a CLI connector tool: the agent passes an
argument list, the runner injects CORTEX_PROXY_URL (and, if the deployment
requires it, CORTEX_PROXY_API_KEY) into the environment (resolved from the
cortex-config credential store). Prints the grounded answer followed by a
numbered source list; exits non-zero with a clear message on any failure so
the agent can react.

Routed through cortex-proxy -> OpenRouter -> Perplexity instead of calling
Perplexity's native API directly, so no separate PERPLEXITY_API_KEY is
needed org-wide. See PROJECT/cortex2.0-task-perplexity-via-cortex-proxy.md
(Obsidian) for the migration design and open verification items - notably,
citation shape through this path is best-effort until confirmed live.

The runner enforces a 60s tool timeout, so the slow "deep research" model is
deliberately not offered here.
"""

import argparse
import os
import sys

import httpx

MODELS = ["perplexity/sonar", "perplexity/sonar-pro", "perplexity/sonar-reasoning-pro"]
RECENCY = ["day", "week", "month", "year"]
REQUEST_TIMEOUT_S = 50


def extract_sources(data: dict, message: dict) -> list[str]:
    """Collects source URLs, order-preserved and deduplicated.

    Checks both known citation shapes since the exact one returned through
    cortex-proxy/OpenRouter for Perplexity models is not yet confirmed by a
    live call (see design note):
      - top-level `citations`: native Perplexity chat-completions format,
        a flat list of URL strings (docs.perplexity.ai/api-reference/chat-completions-post).
      - `message.annotations`: OpenRouter's standardized web-search citation
        format, `{"type": "url_citation", "url_citation": {"url": ..., ...}}`
        (openrouter.ai/docs/guides/features/plugins/web-search).
    """
    urls: list[str] = []

    for url in data.get("citations") or []:
        if isinstance(url, str) and url not in urls:
            urls.append(url)

    for annotation in message.get("annotations") or []:
        if not isinstance(annotation, dict) or annotation.get("type") != "url_citation":
            continue
        url = (annotation.get("url_citation") or {}).get("url")
        if isinstance(url, str) and url not in urls:
            urls.append(url)

    return urls


def main() -> int:
    parser = argparse.ArgumentParser(description="Web search with citations (Perplexity via cortex-proxy)")
    parser.add_argument("query", nargs="+", help="Search query")
    parser.add_argument("--model", choices=MODELS, default="perplexity/sonar")
    parser.add_argument("--recency", choices=RECENCY, help="Only sources from this period")
    parser.add_argument(
        "--domains",
        help="Comma-separated domain filter; prefix a domain with '-' to exclude it",
    )
    parser.add_argument("--academic", action="store_true", help="Academic sources mode")
    parser.add_argument("--max-tokens", type=int, default=1500)
    args = parser.parse_args()

    base_url = os.environ.get("CORTEX_PROXY_URL", "")
    if not base_url:
        print(
            "CORTEX_PROXY_URL is not set. The connector's credential ref is missing "
            "or unresolved in the cortex-config credential store.",
            file=sys.stderr,
        )
        return 2

    # Unlike the previous PERPLEXITY_API_KEY, an API key here is optional:
    # cortex-proxy's authMiddleware validates X-User-ID, not the client's
    # bearer token (confirmed against another cortex-proxy caller in this
    # repo, app/idp/app/api/ai-tools/generate/route.ts).
    api_key = os.environ.get("CORTEX_PROXY_API_KEY", "")
    user_id = os.environ.get("COWORK_USER_EMAIL", "web-search-connector")

    endpoint = f"{base_url.rstrip('/')}/v1/chat/completions"

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

    headers = {
        "Content-Type": "application/json",
        "X-User-ID": user_id,
        "X-App": "Cortex Cowork",
        "X-Scope": "web-search",
        "X-Source-App": "Cortex Cowork web-search connector",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = httpx.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_S,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        print(f"Cortex Proxy error {error.response.status_code}: {error.response.text[:500]}", file=sys.stderr)
        return 1
    except httpx.HTTPError as error:
        print(f"Cortex Proxy request failed: {error}", file=sys.stderr)
        return 1

    data = response.json()
    message = (data.get("choices") or [{}])[0].get("message", {})
    answer = message.get("content", "")
    sources = extract_sources(data, message)

    print(answer.strip())
    if sources:
        print("\nSources:")
        for index, url in enumerate(sources, start=1):
            print(f"[{index}] {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
