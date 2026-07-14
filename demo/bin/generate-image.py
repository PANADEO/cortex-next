#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["google-genai", "pillow"]
# ///
"""Image generation CLI connector for Cortex Cowork - Gemini image model.

Invoked by the cowork-runner as a CLI connector tool: the agent passes an
argument list, the runner injects GEMINI_API_KEY into the environment
(resolved from the cortex-config credential store).

Styles are embedded (adapted from the mag-visual-generate skill) so the
script is self-contained; --style also accepts a free-form description.

Guardrail: when COWORK_SANDBOX_DIR is present in the environment (it always
is when spawned by the runner), --out must resolve inside that sandbox -
a connector tool must not write anywhere else on the host.
"""

import argparse
import os
import sys
from pathlib import Path

MODEL = "gemini-2.5-flash-image"

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


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate an image with Gemini")
    parser.add_argument("prompt", nargs="+", help="Image subject/scene description (English works best)")
    parser.add_argument(
        "--style",
        default="corporate",
        help=f"Style name ({', '.join(sorted(STYLES))}) or a free-form style description",
    )
    parser.add_argument("--out", required=True, help="Output file path (inside the session sandbox)")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print(
            "GEMINI_API_KEY is not set. The connector's credential ref is missing "
            "or unresolved in the cortex-config credential store.",
            file=sys.stderr,
        )
        return 2

    output_path = resolve_output_path(args.out)
    style_desc = STYLES.get(args.style, args.style)
    prompt = " ".join(args.prompt)
    full_prompt = f"{style_desc}\n\nSubject/Scene: {prompt}"

    from google import genai

    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(model=MODEL, contents=[full_prompt])
    except Exception as error:  # noqa: BLE001 - surface any API failure to the agent
        print(f"Gemini API error: {error}", file=sys.stderr)
        return 1

    for part in response.parts or []:
        if part.inline_data is not None:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            image = part.as_image()
            image.save(str(output_path))
            print(str(output_path))
            return 0

    print("No image data in the API response (prompt may have been refused).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
