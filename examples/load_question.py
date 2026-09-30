"""Minimal example: load a test question, its 4 focus documents (text + weights) and optionally the ground truth.

Usage:
    python3 examples/load_question.py Q01            # question + focus docs
    python3 examples/load_question.py Q01 --truth    # also print the expected answer
    python3 examples/load_question.py --all-text     # dump every document as plain text into build/corpus.jsonl
"""
import html
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def read_text(rel_path):
    p = DATA / rel_path
    ext = p.suffix.lower()
    if ext in (".md", ".eml", ".csv", ".json", ".txt"):
        return p.read_text(encoding="utf-8", errors="ignore")
    if ext == ".pdf":
        return subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True).stdout
    if ext == ".docx":
        xml = zipfile.ZipFile(p).read("word/document.xml").decode("utf-8")
        xml = re.sub(r"</w:p>", "\n", xml)
        return html.unescape(re.sub(r"<[^>]+>", "", xml))
    if ext == ".png":
        return "[scanned image – run OCR, e.g. pytesseract.image_to_string(Image.open(path), lang='fra')]"
    return ""


def manifest():
    return {m["id"]: m for m in json.loads((DATA / "manifest.json").read_text())["items"]}


def show_question(qid, truth=False):
    q = json.loads((DATA / "questions" / f"{qid}.json").read_text())
    docs = manifest()
    print(f"{qid}: {q['question']}\n")
    for f in q["focus_docs"]:
        m = docs[f["id"]]
        print(f"--- {m['id']}  [{m['folder']}]  weight={m['final_weight']}  legal_rank={m['legal_rank']}  "
              f"factors={m['weight_factors']}")
        print(read_text(m["path"])[:1200].strip(), "\n")
    print(f"supporting docs ({len(q['supporting_docs'])}): {', '.join(q['supporting_docs'])}")
    if truth:
        gt = json.loads((DATA / "_ground_truth" / f"{qid}.json").read_text())
        print(f"\nEXPECTED ({gt['verdict']}): {gt['expected_answer']}")


def dump_corpus():
    out = DATA.parent / "build" / "corpus.jsonl"
    out.parent.mkdir(exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for m in manifest().values():
            fh.write(json.dumps({"id": m["id"], "text": read_text(m["path"]),
                                 **{k: m.get(k) for k in ("folder", "doc_type", "title", "language", "jurisdiction",
                                                          "date", "themes", "final_weight", "legal_rank", "status")}},
                                ensure_ascii=False) + "\n")
    print(f"written {out}")


if __name__ == "__main__":
    if "--all-text" in sys.argv:
        dump_corpus()
    else:
        show_question(sys.argv[1] if len(sys.argv) > 1 else "Q01", truth="--truth" in sys.argv)
