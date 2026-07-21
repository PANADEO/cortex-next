#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["pypdf"]
# ///
"""Document text extraction CLI connector for Cortex Cowork.

Invoked by the cowork-runner as a CLI connector tool: the agent passes an
argument list. Reads PDF (pypdf), DOCX (stdlib zip + XML strip) and plain
text files staged in the session sandbox, so the agent can work with source
documents without loading megabytes into its context:

  extract-doc.py input/instrukcja.pdf                      -> stats + preview
  extract-doc.py input/instrukcja.pdf --grep "personel"    -> matches with context
  extract-doc.py input/instrukcja.pdf --pages 40-60 --out work/instr.txt
  extract-doc.py input/opis.docx --out work/opis.txt       -> full text to file

--grep is case- and diacritic-insensitive ("wynagrodzen" matches
"wynagrodzeń"), which matters for Polish grant paperwork.

Guardrail: when COWORK_SANDBOX_DIR is present in the environment (it always
is when spawned by the runner), both the input file and --out must resolve
inside that sandbox - a connector tool must not read or write anywhere else
on the host.
"""

import argparse
import html
import os
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

PREVIEW_CHARS = 2000
DEFAULT_CONTEXT = 1200
DEFAULT_MAX_HITS = 5


def fail(message: str) -> "sys.NoReturn":
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def guard_sandbox(path: Path, role: str) -> Path:
    resolved = path.resolve()
    sandbox = os.environ.get("COWORK_SANDBOX_DIR")
    if sandbox:
        sandbox_root = Path(sandbox).resolve()
        if not resolved.is_relative_to(sandbox_root):
            fail(f"{role} must point inside the session sandbox ({sandbox_root}); got {resolved}")
    return resolved


def extract_pdf(path: Path, pages: tuple[int, int] | None) -> str:
    import pypdf

    reader = pypdf.PdfReader(str(path))
    total = len(reader.pages)
    first, last = pages if pages else (1, total)
    first, last = max(1, first), min(total, last)
    parts: list[str] = []
    for index in range(first - 1, last):
        parts.append(f"=== STRONA {index + 1}/{total} ===")
        parts.append(reader.pages[index].extract_text() or "")
    return "\n".join(parts)


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="replace")
    xml = re.sub(r"<w:tab[^>]*/>", "\t", xml)
    xml = re.sub(r"<w:br[^>]*/>", "\n", xml)
    xml = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract(path: Path, pages: tuple[int, int] | None) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf(path, pages)
    if suffix == ".docx":
        return extract_docx(path)
    return path.read_text(encoding="utf-8", errors="replace")


def fold(text: str) -> tuple[str, list[int]]:
    """Lowercased, diacritic-stripped copy plus a map back to original indices."""
    folded: list[str] = []
    index_map: list[int] = []
    for index, char in enumerate(text):
        for part in unicodedata.normalize("NFD", char):
            if unicodedata.combining(part):
                continue
            folded.append(part.lower())
            index_map.append(index)
    return "".join(folded), index_map


def grep(text: str, pattern: str, context: int, max_hits: int) -> None:
    haystack, index_map = fold(text)
    needle, _ = fold(pattern)
    if not needle:
        fail("--grep pattern is empty after normalization")
    hits = 0
    position = 0
    while hits < max_hits:
        found = haystack.find(needle, position)
        if found == -1:
            break
        start = index_map[max(0, found - context)]
        end_folded = min(len(index_map) - 1, found + len(needle) + context)
        end = index_map[end_folded] + 1
        hits += 1
        print(f"--- trafienie {hits} (okolica znaków {start}-{end}) ---")
        print(text[start:end].strip())
        print()
        position = found + len(needle)
    remaining = haystack.count(needle, position)
    if hits == 0:
        print(f'Brak trafień dla "{pattern}".')
    elif remaining:
        print(f"(+{remaining} dalszych trafień - zawęź --pages albo doprecyzuj wzorzec)")


def parse_pages(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d+)-(\d+)", value.strip())
    if not match:
        fail("--pages expects a range like 40-60")
    return int(match.group(1)), int(match.group(2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract text from PDF/DOCX/TXT in the session sandbox")
    parser.add_argument("file", help="Path to the document (inside the session sandbox)")
    parser.add_argument("--grep", help="Print matches with surrounding context (case/diacritic-insensitive)")
    parser.add_argument("--context", type=int, default=DEFAULT_CONTEXT, help=f"Context chars around a match (default {DEFAULT_CONTEXT})")
    parser.add_argument("--max-hits", type=int, default=DEFAULT_MAX_HITS, help=f"Max matches printed (default {DEFAULT_MAX_HITS})")
    parser.add_argument("--pages", help="PDF only: limit to a page range, e.g. 40-60")
    parser.add_argument("--out", help="Write the full extracted text to this file (inside the sandbox)")
    args = parser.parse_args()

    source = guard_sandbox(Path(args.file), "file")
    if not source.is_file():
        fail(f"no such file: {source}")
    pages = parse_pages(args.pages) if args.pages else None

    try:
        text = extract(source, pages)
    except Exception as error:  # noqa: BLE001 - surface every parser failure to the agent
        fail(f"could not extract text from {source.name}: {error}")

    if args.out:
        target = guard_sandbox(Path(args.out), "--out")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        print(f"Zapisano {len(text)} znaków do {args.out}")

    if args.grep:
        grep(text, args.grep, args.context, args.max_hits)
    elif not args.out:
        print(f"{source.name}: {len(text)} znaków po ekstrakcji.")
        print(f"--- pierwsze {min(len(text), PREVIEW_CHARS)} znaków ---")
        print(text[:PREVIEW_CHARS])
        if len(text) > PREVIEW_CHARS:
            print("... (użyj --grep, --pages albo --out żeby dostać resztę)")


if __name__ == "__main__":
    main()
