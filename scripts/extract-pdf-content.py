from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from pypdf import PdfReader


def extract_pdf(input_path: Path) -> dict:
    reader = PdfReader(str(input_path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").replace("\x00", "").strip()
        media_box = page.mediabox
        pages.append(
            {
                "page": index,
                "text": text,
                "charCount": len(text),
                "width": float(media_box.width),
                "height": float(media_box.height),
            }
        )
    return {
        "schemaVersion": 1,
        "sourceName": input_path.name,
        "sourceSha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
        "pageCount": len(pages),
        "pages": pages,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract page-indexed PDF text for the private learning pack")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    result = extract_pdf(args.input.resolve())
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extracted {result['pageCount']} pages to {output}")


if __name__ == "__main__":
    main()
