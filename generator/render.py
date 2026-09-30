"""Render the synthetic sources into data/ and write generator/catalog_synth.json.

Sources live in generator/synth/*.bundle. A bundle holds many documents, each starting with
a line `@@@ FILE <ID>` followed by a YAML front-matter block (--- ... ---) and the body.

Front matter keys: folder, format (md|pdf|docx|eml|csv|json|png), title, doc_type, author,
author_role, date, jurisdiction, language, themes, status, signed, supersedes,
related_employees, related_questions, conflict_of_interest, formality.

Markdown bodies are converted to HTML then to PDF/DOCX with LibreOffice (soffice).
"""
import html
import json
import random
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

GEN = Path(__file__).resolve().parent
DATA = GEN.parent / "data"
CATALOG = GEN / "catalog_synth.json"
FOOTER = "Synthetic document – Tectonic 2026 hackathon dataset. Company, people and events are fictional."

CSS = """
body { font-family: 'Liberation Serif', 'Times New Roman', serif; font-size: 11pt; line-height: 1.35; margin: 2cm; }
h1 { font-size: 16pt; margin-bottom: 4pt; } h2 { font-size: 13pt; margin-top: 14pt; } h3 { font-size: 11.5pt; }
table { border-collapse: collapse; margin: 6pt 0; } td, th { border: 1px solid #555; padding: 3pt 6pt; font-size: 10pt; vertical-align: top; }
th { background: #e8e8e8; } .footer { margin-top: 24pt; font-size: 8pt; color: #666; border-top: 1px solid #aaa; padding-top: 4pt; }
.letterhead { font-family: 'Liberation Sans', Arial, sans-serif; font-size: 9pt; color: #333; border-bottom: 2px solid #1d3b6e; padding-bottom: 4pt; margin-bottom: 12pt; }
"""


# --------------------------------------------------------------------------- parsing
def parse_bundles():
    docs = []
    for bundle in sorted(GEN.glob("synth/*.bundle")):
        chunks = re.split(r"(?m)^@@@ FILE (\S+)\s*$", bundle.read_text(encoding="utf-8"))
        for i in range(1, len(chunks), 2):
            doc_id, raw = chunks[i], chunks[i + 1]
            m = re.match(r"\s*---\n(.*?)\n---\n?(.*)", raw, flags=re.S)
            if not m:
                sys.exit(f"{bundle.name}: {doc_id} has no front matter")
            meta = yaml.safe_load(m.group(1))
            meta["id"] = doc_id
            meta["_body"] = m.group(2).strip("\n") + "\n"
            meta["_bundle"] = bundle.name
            docs.append(meta)
    ids = [d["id"] for d in docs]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        sys.exit(f"duplicate ids: {dupes}")
    return docs


# --------------------------------------------------------------------------- markdown → html
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", s)
    return s


def md_to_html(md, title, letterhead=None):
    out, para, lst, table = [], [], None, []

    def flush():
        nonlocal para, lst, table
        if para:
            out.append("<p>" + "<br/>".join(inline(p) for p in para) + "</p>")
            para = []
        if lst:
            tag, items = lst
            out.append(f"<{tag}>" + "".join(f"<li>{inline(i)}</li>" for i in items) + f"</{tag}>")
            lst = None
        if table:
            rows = [r for r in table if not re.match(r"^\|?\s*:?-{2,}", r)]
            cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
            h = "".join(f"<th>{inline(c)}</th>" for c in cells[0])
            b = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in cells[1:])
            out.append(f"<table><tr>{h}</tr>{b}</table>")
            table = []

    for line in md.splitlines():
        s = line.rstrip()
        if not s.strip():
            flush()
        elif s.startswith("|"):
            if para or lst:
                flush()
            table.append(s)
        elif m := re.match(r"^(#{1,3})\s+(.*)", s):
            flush()
            n = len(m.group(1))
            out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
        elif s.strip() == "---":
            flush()
            out.append("<hr/>")
        elif m := re.match(r"^\s*[-•]\s+(.*)", s):
            if table or para:
                flush()
            if lst and lst[0] != "ul":
                flush()
            lst = lst or ("ul", [])
            lst[1].append(m.group(1))
        elif m := re.match(r"^\s*\d+[.)]\s+(.*)", s):
            if table or para:
                flush()
            if lst and lst[0] != "ol":
                flush()
            lst = lst or ("ol", [])
            lst[1].append(m.group(1))
        else:
            if lst or table:
                flush()
            para.append(s.strip())
    flush()
    head = f'<div class="letterhead">{letterhead}</div>' if letterhead else ""
    return (f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
            f"<style>{CSS}</style></head><body>{head}{''.join(out)}"
            f"<div class='footer'>{FOOTER}</div></body></html>")


LETTERHEAD = ("<b>Tectonic Solutions SA/NV</b> · Rue des Tanneurs 58, 1000 Bruxelles · "
              "BCE/KBO 0799.451.237 · CP/PC 200")


def soffice(src_html, fmt, out_path):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        src = tmp / (out_path.stem + ".html")
        shutil.copy(src_html, src)
        target = {"pdf": "pdf:writer_pdf_Export", "docx": 'docx:"MS Word 2007 XML"'}[fmt]
        cmd = f'soffice --headless --infilter="HTML (StarWriter)" --convert-to {target} --outdir "{tmp}" "{src}"'
        subprocess.run(cmd, shell=True, check=True, capture_output=True,
                       env={"HOME": str(tmp), "PATH": "/usr/bin:/bin"})
        shutil.move(tmp / f"{out_path.stem}.{fmt}", out_path)


def scan_png(pdf_path, png_path, seed):
    """Make a 'scanned' image: rasterise page 1, slight rotation, grey tint and noise."""
    from PIL import Image, ImageFilter
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "110", "-f", "1", "-l", "1", "-png", str(pdf_path), f"{tmp}/p"], check=True)
        img = Image.open(next(Path(tmp).glob("p*.png"))).convert("L")
    rnd = random.Random(seed)
    img = img.rotate(rnd.uniform(-1.4, 1.4), expand=True, fillcolor=235)
    px = img.load()
    for _ in range(img.size[0] * img.size[1] // 60):
        x, y = rnd.randrange(img.size[0]), rnd.randrange(img.size[1])
        px[x, y] = max(0, px[x, y] - rnd.randint(40, 120))
    img = img.filter(ImageFilter.GaussianBlur(0.5)).point(lambda v: int(v * 0.92 + 12))
    img.save(png_path, optimize=True)


# --------------------------------------------------------------------------- render
def render(doc, tmpdir):
    fmt = doc["format"]
    folder = DATA / doc["folder"]
    folder.mkdir(parents=True, exist_ok=True)
    out = folder / f"{doc['id']}.{fmt}"
    body = doc["_body"]
    if fmt in ("pdf", "docx", "png"):
        lh = LETTERHEAD if doc.get("letterhead", True) else None
        h = tmpdir / f"{doc['id']}.html"
        h.write_text(md_to_html(body, doc["title"], lh), encoding="utf-8")
        if fmt == "png":
            pdf = tmpdir / f"{doc['id']}.pdf"
            soffice(h, "pdf", pdf)
            scan_png(pdf, out, doc["id"])
        else:
            soffice(h, fmt, out)
    elif fmt == "md":
        out.write_text(f"{body.rstrip()}\n\n---\n*{FOOTER}*\n", encoding="utf-8")
    elif fmt == "eml":
        hdr, _, text = body.partition("\n\n")
        out.write_text(f"{hdr}\nX-Dataset-Note: {FOOTER}\nMIME-Version: 1.0\n"
                       f"Content-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: 8bit\n\n{text}",
                       encoding="utf-8")
    elif fmt == "json":
        obj = json.loads(body)
        obj = {"_dataset_note": FOOTER, **obj} if isinstance(obj, dict) else {"_dataset_note": FOOTER, "items": obj}
        out.write_text(json.dumps(obj, indent=1, ensure_ascii=False), encoding="utf-8")
    elif fmt == "csv":
        out.write_text(body, encoding="utf-8")
    else:
        sys.exit(f"unknown format {fmt} for {doc['id']}")
    return out


def main():
    only = set(sys.argv[1:])
    docs = parse_bundles()
    catalog = {d["id"]: d for d in json.loads(CATALOG.read_text())} if CATALOG.exists() and only else {}
    with tempfile.TemporaryDirectory() as tmp:
        for doc in docs:
            if only and doc["id"] not in only and doc["_bundle"] not in only:
                continue
            out = render(doc, Path(tmp))
            meta = {k: v for k, v in doc.items() if not k.startswith("_")}
            meta["path"] = str(out.relative_to(DATA))
            meta["synthetic"] = True
            catalog[doc["id"]] = meta
            print(f"{doc['id']:<34} -> {meta['path']}")
    CATALOG.write_text(json.dumps(list(catalog.values()), indent=1, ensure_ascii=False, default=str))
    print(f"{len(catalog)} synthetic documents rendered")


if __name__ == "__main__":
    main()
