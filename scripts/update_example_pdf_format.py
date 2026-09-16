from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"


def update_pdf(path: Path) -> None:
    document = fitz.open(path)
    metadata = document.metadata
    title = metadata.get("title", "").replace("Project Portal", "Portable Inspection")
    if path.stem == "rebar-example" and title == path.stem:
        title = "鋼筋工程查驗表｜Portable Inspection"
    if path.stem == "steel-structure-example" and title == path.stem:
        title = "鋼構施工複核表｜Portable Inspection"
    metadata["title"] = title
    document.set_metadata(metadata)

    # Legacy examples placed the descriptive footer note at inconsistent
    # positions when a page overflowed. Remove only matching text blocks so
    # tables and the lower-right signature block remain untouched.
    for page in document:
        for block in page.get_text("blocks"):
            if any(marker in block[4] for marker in ("資料版本", "輸出時間", "範例資料", "正式紀錄")):
                page.add_redact_annot(fitz.Rect(block[:4]), fill=(1, 1, 1))
        page.apply_redactions()

    temporary = path.with_suffix(".updated.pdf")
    document.save(temporary, garbage=4, deflate=True)
    document.close()
    temporary.replace(path)


if __name__ == "__main__":
    for pdf in sorted(EXAMPLES.glob("*.pdf")):
        update_pdf(pdf)
        print(f"Updated {pdf.name}")
