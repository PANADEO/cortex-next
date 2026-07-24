#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["httpx", "pillow"]
# ///
"""Image generation CLI connector for Cortex Cowork - Gemini image model via cortex-proxy.

Invoked by the cowork-runner as a CLI connector tool: the agent passes an
argument list, the runner injects CORTEX_PROXY_URL (and, if the deployment
requires it, CORTEX_PROXY_API_KEY) into the environment (resolved from the
cortex-config credential store).

Routed through cortex-proxy -> OpenRouter -> Gemini instead of calling the
native google-genai SDK directly, so no separate GEMINI_API_KEY is needed
org-wide. This mirrors the precedent already running in production for the
`ilustromat` tile (ilustromat/core/generator.py): POST /v1/chat/completions
with `modalities: ["image", "text"]`, image returned as a base64 data URI in
`choices[0].message.images[0].image_url.url` - a different contract than the
native SDK's `response.parts[].inline_data`. See
PROJECT/cortex2.0-task-gemini-via-cortex-proxy.md (Obsidian) for the full
migration design and open verification items - notably, the cowork-runner's
CLI connector timeout (60s) is shorter than the 90s ilustromat itself budgets
for this same model, so this may need re-tuning once verified live.

Styles are embedded (adapted from the mag-visual-generate skill) so the
script is self-contained; --style also accepts a free-form description.

Guardrail: when COWORK_SANDBOX_DIR is present in the environment (it always
is when spawned by the runner), --out must resolve inside that sandbox -
a connector tool must not write anywhere else on the host.
"""

import argparse
import base64
import io
import os
import sys
from pathlib import Path

import httpx

# Default matches the confirmed-working ilustromat precedent (config.py),
# not the previous native-SDK model id (gemini-2.5-flash-image), which isn't
# 1:1 transferable to OpenRouter's catalog naming. Override with IMAGE_MODEL.
MODEL = os.environ.get("IMAGE_MODEL", "google/gemini-3.1-flash-lite-image")

# Below the runner's hard 60s CLI connector timeout (cowork-runner/src/connectors.ts,
# CLI_TIMEOUT_MS) so a slow response surfaces as a clear httpx timeout message
# instead of a silent SIGKILL. NOT a fix for the underlying risk: ilustromat
# itself budgets 90s for this same model - see design note.
REQUEST_TIMEOUT_S = 55

STYLES: dict[str, str] = {
    "mckinsey": (
        "Professional business publication illustration style: clean sophisticated "
        "vector-like graphics; limited palette of navy blue, teal and coral/orange accents "
        "on white; geometric shapes and abstract, conceptual imagery; high-end editorial "
        "aesthetic; minimalist with strategic negative space; subtle gradients for depth; "
        "no photography; evokes strategy and executive thinking."
    ),
    "corporate": (
        "Professional corporate illustration: clean modern design with subtle gradients; "
        "professional palette of blues, whites and gray accents; minimalist iconography and "
        "geometric shapes; high contrast, readable elements; polished, business-appropriate, "
        "trust-inspiring aesthetic; no playful elements."
    ),
    "infographic": (
        "Clean infographic illustration style: clear visual hierarchy; icons and symbols "
        "representing concepts; professional color coding (blues, greens, oranges); "
        "structured layout with visual flow; flat design with subtle shadows; arrows showing "
        "connections and processes; minimal text; easy to scan at a glance."
    ),
    "isometric": (
        "Isometric projection illustration: 3D objects at 30-degree angles; clean vector "
        "graphics with flat colors; vibrant but harmonious palette; technical precision; "
        "detailed miniature-world feel; consistent lighting and shadows; modern tech company "
        "style, perfect for explaining systems."
    ),
    "tech": (
        "Modern technology-focused illustration: circuit-like patterns and digital "
        "connections; neural network and data flow aesthetics; glowing elements on a dark "
        "background; blue, cyan and purple accents with white highlights; clean geometric "
        "grids; holographic glow effects; high-tech corporate feel for AI and software topics."
    ),
    "minimal": (
        "Ultra-minimal visual design: maximum simplicity, essential elements only; single "
        "focal point; 2-3 colors maximum; abundant negative space (70%+ empty); clean precise "
        "geometric lines; zen-like calm; one clear message; no gradients, shadows or effects."
    ),
    "whiteboard": (
        "Photograph of a whiteboard or flipchart in a meeting room: hand-drawn sketches with "
        "colored markers (blue, red, green, black); slightly imperfect lines as if drawn by "
        "hand; visible marker texture and smudges; simple diagrams, arrows, boxes, stick "
        "figures; optional post-it notes; natural office lighting, slight phone-camera "
        "perspective; business workshop aesthetic."
    ),
    "sketch": (
        "Hand-drawn pencil or pen sketch aesthetic: black and white or limited grayscale; "
        "natural imperfections in linework; crosshatching and shading; notebook paper "
        "texture; architect or designer notebook feel; shows thought process; authentic "
        "human touch."
    ),
    "watercolor": (
        "Artistic watercolor illustration: soft flowing color washes; visible brush strokes "
        "and paint texture; colors bleeding naturally; paper texture showing through; pastel "
        "or muted palette; organic shapes with soft edges; delicate, elegant, fine-art feel."
    ),
    "cartoon": (
        "Friendly cartoon illustration for children: bright cheerful colors; round soft "
        "shapes and friendly characters; simple clear imagery; exaggerated expressions; thick "
        "outlines; flat colors with minimal shading; whimsical, safe, approachable feeling."
    ),
    "retro": (
        "1960s-70s retro graphic design aesthetic: bold geometric shapes; warm limited "
        "palette (orange, brown, mustard, teal); halftone dots and print textures; rounded "
        "shapes; mid-century modern elements; grain for aged effect; poster or album cover "
        "aesthetic."
    ),
}


def resolve_output_path(raw: str) -> Path:
    out = Path(raw).expanduser().resolve()
    sandbox = os.environ.get("COWORK_SANDBOX_DIR")
    if sandbox:
        sandbox_root = Path(sandbox).resolve()
        if not out.is_relative_to(sandbox_root):
            print(
                f"--out must point inside the session sandbox ({sandbox_root}); got {out}",
                file=sys.stderr,
            )
            raise SystemExit(2)
    if out.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        out = out.with_suffix(".png")
    return out


def extract_image_data_uri(data: dict) -> str | None:
    """Pulls the base64 data URI out of a cortex-proxy/OpenRouter image response.

    Shape (confirmed against ilustromat/core/generator.py, the production
    precedent for this exact model/path):
    `choices[0].message.images[0].image_url.url`, an OpenAI-compatible
    chat-completions extension for `modalities: ["image", "text"]` responses.

    Every access point is isinstance-guarded because cortex-proxy/OpenRouter
    is an external boundary: a malformed or unexpected-shape response must
    surface as None (-> a clean "no image data" message in main()), not an
    uncaught AttributeError.
    """
    choices = data.get("choices")
    first_choice = choices[0] if isinstance(choices, list) and choices else None
    if not isinstance(first_choice, dict):
        return None
    message = first_choice.get("message")
    if not isinstance(message, dict):
        return None
    images = message.get("images")
    first_image = images[0] if isinstance(images, list) and images else None
    if not isinstance(first_image, dict):
        return None
    image_url = first_image.get("image_url")
    if not isinstance(image_url, dict):
        return None
    url = image_url.get("url")
    return url if isinstance(url, str) else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate an image with Gemini via cortex-proxy")
    parser.add_argument("prompt", nargs="+", help="Image subject/scene description (English works best)")
    parser.add_argument(
        "--style",
        default="corporate",
        help=f"Style name ({', '.join(sorted(STYLES))}) or a free-form style description",
    )
    parser.add_argument("--out", required=True, help="Output file path (inside the session sandbox)")
    args = parser.parse_args()

    base_url = os.environ.get("CORTEX_PROXY_URL", "")
    if not base_url:
        print(
            "CORTEX_PROXY_URL is not set. The connector's credential ref is missing "
            "or unresolved in the cortex-config credential store.",
            file=sys.stderr,
        )
        return 2

    # Unlike the previous GEMINI_API_KEY, an API key here is optional:
    # cortex-proxy's authMiddleware validates X-User-ID, not the client's
    # bearer token (confirmed against another cortex-proxy caller in this
    # repo, app/idp/app/api/ai-tools/generate/route.ts).
    api_key = os.environ.get("CORTEX_PROXY_API_KEY", "")
    user_id = os.environ.get("COWORK_USER_EMAIL", "generate-image-connector")

    output_path = resolve_output_path(args.out)
    style_desc = STYLES.get(args.style, args.style)
    prompt = " ".join(args.prompt)
    full_prompt = f"{style_desc}\n\nSubject/Scene: {prompt}"

    endpoint = f"{base_url.rstrip('/')}/v1/chat/completions"
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": full_prompt}],
        "modalities": ["image", "text"],
    }
    headers = {
        "Content-Type": "application/json",
        "X-User-ID": user_id,
        "X-App": "Cortex Cowork",
        "X-Scope": "image-generation",
        "X-Source-App": "Cortex Cowork generate-image connector",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = httpx.post(endpoint, json=payload, headers=headers, timeout=REQUEST_TIMEOUT_S)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        print(f"Cortex Proxy error {error.response.status_code}: {error.response.text[:500]}", file=sys.stderr)
        return 1
    except httpx.HTTPError as error:
        print(f"Cortex Proxy request failed: {error}", file=sys.stderr)
        return 1

    try:
        data = response.json()
    except ValueError as error:
        print(f"Cortex Proxy returned a response that isn't valid JSON: {error}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print(
            f"Cortex Proxy returned an unexpected response shape (expected a JSON object, got {type(data).__name__}).",
            file=sys.stderr,
        )
        return 1

    image_url = extract_image_data_uri(data)
    if not image_url:
        print(
            "No image data in the API response (prompt may have been refused).",
            file=sys.stderr,
        )
        return 1
    if not image_url.startswith("data:"):
        print(
            f"Unexpected image format from Cortex Proxy (expected a base64 data URI, got: {image_url[:80]!r}).",
            file=sys.stderr,
        )
        return 1

    from PIL import Image

    _, _, b64_data = image_url.partition(",")
    try:
        raw = base64.b64decode(b64_data)
        image = Image.open(io.BytesIO(raw))
    except Exception as error:  # noqa: BLE001 - surface any decode failure to the agent
        print(f"Failed to decode returned image data: {error}", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(str(output_path))
    print(str(output_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
