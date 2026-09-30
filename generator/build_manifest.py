"""Build data/manifest.json (+ .csv), data/questions/*.json, data/_ground_truth/*.json and validate the dataset.

Two separate scores per document:
- credibility_weight (0–1): how trustworthy the document is as evidence of facts / of what the rule says.
- legal_rank (1–6, or null): position in the Belgian hierarchy of norms (art. 51 Law of 5 Dec 1968); lower wins.
Plus applicability (0–1): does the document govern a Belgian employment relationship?
final_weight = credibility_weight × applicability.
"""
import csv
import json
import sys
from datetime import date
from pathlib import Path

import yaml

GEN = Path(__file__).resolve().parent
DATA = GEN.parent / "data"
sys.path.insert(0, str(GEN))
from cases import COMPANY, LEGAL_RANK, PEOPLE, QUESTIONS, THEMES  # noqa: E402

TODAY = date(2026, 9, 30)

BASE = {"01_legislation": 1.00, "02_case_law": 0.90, "03_collective_agreements": 0.90,
        "04_official_guidance": 0.80, "05_company_policies": 0.85, "05_company_policies/archive": 0.40,
        "06_contracts": 0.85, "07_official_records": 0.75, "08_investigations": 0.70, "09_statements": 0.50,
        "10_emails": 0.55, "11_chat_messages": 0.40, "12_performance": 0.65, "13_external_secondary": 0.35}

# document-specific notes for real sources
NOTES = {
    "EU-REG-2004-883-SOCSEC": "Original OJ text (2004). Articles 11–13 were later amended (Reg. 988/2009, 465/2012): check the consolidated version.",
    "LAW-BE-1996-RETALIATION-FR": "Justel numbers the article 32terdecies; commonly cited as 32tredecies.",
    "EXT-SDWORX-TELEWERK-BUITENLAND-2021": "2021 article – rules on cross-border telework changed since (framework agreement 2023).",
}


def legal_rank(m):
    f, t = m["folder"], m.get("doc_type", "")
    if f == "01_legislation":
        return 1
    if f == "03_collective_agreements":
        return 3 if m["id"].startswith("CCT-TEC") else 2
    if f == "06_contracts" and t in ("employment_contract", "contract_amendment", "telework_annex", "contract_annex"):
        return 4
    if t == "work_regulations":
        return 5
    if f == "05_company_policies":
        return 6
    return None  # evidence / interpretation, not a norm


def credibility(m):
    key = m["path"].rsplit("/", 1)[0]
    base = BASE.get(key, BASE[m["folder"]])
    factors = []
    status, formality = m.get("status", ""), m.get("formality", "")
    if m.get("signed") and m["folder"] not in ("01_legislation", "02_case_law"):
        factors.append(("signed", 1.10))
    if status == "draft":
        factors.append(("draft", 0.60))
    if status == "informal" or formality in ("informal_note",):
        factors.append(("informal", 0.80))
    if formality == "internal_guideline":
        factors.append(("internal guideline, not adopted as work regulations", 0.90))
    if formality == "system_record":
        factors.append(("system-generated record", 1.10))
    if formality == "statutory_opinion":
        factors.append(("independent statutory procedure", 1.20))
    if m.get("conflict_of_interest"):
        factors.append(("author has a stake in the outcome", 0.70))
    if m["folder"] in ("04_official_guidance", "13_external_secondary") and m.get("date"):
        try:
            age = (TODAY - date.fromisoformat(str(m["date"])[:10])).days / 365
            if age > 3:
                factors.append((f"published {age:.0f} years ago", 0.80))
        except ValueError:
            pass
    if m["id"] in NOTES and "amended" in NOTES[m["id"]]:
        factors.append(("not consolidated", 0.90))
    w = base
    for _, f in factors:
        w *= f
    return round(min(w, 1.0), 3), base, factors


def applicability(m):
    j = m.get("jurisdiction", "BE")
    if j in ("BE", "EU", "COE"):
        return 1.0, "applies to Belgian employment"
    if j == "LU" and m["folder"] == "07_official_records":
        return 1.0, "foreign-issued evidence (valid)"
    return 0.3, f"foreign law ({j}) – comparative value only"


def main():
    real = json.loads((GEN / "catalog_real.json").read_text())
    synth = json.loads((GEN / "catalog_synth.json").read_text())
    docs = {}
    for m in real + synth:
        m = dict(m)
        m["folder"] = m["path"].split("/")[0]
        docs[m["id"]] = m
    errors = []
    for m in docs.values():
        if not (DATA / m["path"]).exists():
            errors.append(f"missing file {m['path']}")
        cred, base, factors = credibility(m)
        app, app_why = applicability(m)
        m["base_weight"] = base
        m["weight_factors"] = [f"{name} ×{f}" for name, f in factors]
        m["credibility_weight"] = cred
        m["legal_rank"] = legal_rank(m)
        m["applicability"] = app
        m["applicability_note"] = app_why
        m["final_weight"] = round(cred * app, 3)
        if m["id"] in NOTES:
            m["note"] = NOTES[m["id"]]
        m.setdefault("related_questions", [])
        for k in ("letterhead", "base_weight_hint"):
            m.pop(k, None)
    # link questions: synthetic docs declare related_questions; real docs are linked when used as focus/winning doc
    for qid, q in QUESTIONS.items():
        used = set(q["focus_docs"]) | {d for c in q["conflicts"] for d in list(c["sides"]) + c["winning_docs"]}
        for d in used:
            if d not in docs:
                errors.append(f"{qid}: unknown document {d}")
            elif qid not in docs[d]["related_questions"]:
                docs[d]["related_questions"].append(qid)
    ordered = sorted(docs.values(), key=lambda m: m["path"])

    # manifest
    (DATA / "manifest.json").write_text(json.dumps(
        {"dataset": "Tectonic 2026 HR-analysis corpus (Belgium)", "generated": TODAY.isoformat(),
         "documents": len(ordered), "themes": THEMES, "legal_rank": LEGAL_RANK,
         "weights": {"base_by_folder": BASE,
                     "formula": "final_weight = credibility_weight × applicability; legal_rank decides between conflicting norms"},
         "items": ordered}, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    cols = ["id", "path", "folder", "doc_type", "title", "language", "jurisdiction", "date", "themes", "status",
            "synthetic", "credibility_weight", "legal_rank", "applicability", "final_weight", "related_questions"]
    with open(DATA / "manifest.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for m in ordered:
            w.writerow([";".join(map(str, m.get(c) or [])) if isinstance(m.get(c), list) else m.get(c) for c in cols])

    # questions (what the system gets) and ground truth (hidden, for scoring)
    for qid, q in QUESTIONS.items():
        support = [m["id"] for m in ordered if qid in m["related_questions"] and m["id"] not in q["focus_docs"]]
        (DATA / "questions" / f"{qid}.json").write_text(json.dumps(
            {"id": qid, "question": q["question"], "themes": q["themes"],
             "focus_docs": [{"id": d, "path": docs[d]["path"], "final_weight": docs[d]["final_weight"],
                             "legal_rank": docs[d]["legal_rank"]} for d in q["focus_docs"] if d in docs],
             "supporting_docs": support}, indent=1, ensure_ascii=False), encoding="utf-8")
        (DATA / "_ground_truth" / f"{qid}.json").write_text(json.dumps(
            {"id": qid, "question": q["question"], "verdict": q["verdict"], "expected_answer": q["expected_answer"],
             "key_facts": q["key_facts"], "conflicts": q["conflicts"], "focus_docs": q["focus_docs"],
             "supporting_docs": support}, indent=1, ensure_ascii=False), encoding="utf-8")

    (GEN / "cases.yaml").write_text(yaml.safe_dump(
        {"company": COMPANY, "people": PEOPLE, "themes": THEMES, "legal_rank": LEGAL_RANK, "questions": QUESTIONS},
        allow_unicode=True, sort_keys=False, width=110), encoding="utf-8")

    # validation
    folders = {}
    for m in ordered:
        folders.setdefault(m["folder"], set()).update(m.get("themes") or [])
    for f, th in sorted(folders.items()):
        miss = sorted(set(THEMES) - th)
        if miss:
            print(f"  note: {f} has no document for themes {miss}")
    for qid, q in QUESTIONS.items():
        if len(q["focus_docs"]) != 4:
            errors.append(f"{qid}: needs exactly 4 focus docs")
    print(f"{len(ordered)} documents ({sum(1 for m in ordered if not m['synthetic'])} real, "
          f"{sum(1 for m in ordered if m['synthetic'])} synthetic), {len(QUESTIONS)} questions")
    if errors:
        print("ERRORS:\n  " + "\n  ".join(errors))
        sys.exit(1)
    print("validation OK")


if __name__ == "__main__":
    main()
