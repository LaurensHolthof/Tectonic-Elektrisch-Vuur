# Tectonic 2026 – HR analysis test dataset (Belgium)

208 documents for testing an HR assistant that answers a question with a **justified reason**, weighs sources by **trust**, and explains **conflicting evidence**.

- **81 real public documents:** Belgian law (Justel), EU law and CJEU judgments (EUR-Lex/CELLAR), ECHR judgments, national CCTs (CNT/NAR), official guidance (SPF Emploi, ONSS, APD), foreign law (DE/NL/FR/UK) and HR-provider articles.
- **127 mock documents** about a fictional company, *Tectonic Solutions SA/NV* (Brussels, Antwerp, Liège, CP 200): policies, contracts, records, investigations, statements, emails, chats and reviews. Every mock file carries a "synthetic / fictional" note.

Languages: FR, NL, EN and DE. Formats: `.md .pdf .docx .eml .csv .json .png` (one scanned image that needs OCR).

## Folder layout

| Folder | Content | Base weight |
|---|---|---|
| `01_legislation/{be_federal,eu,foreign/*}` | statutes (real) | 1.00 |
| `02_case_law` | CJEU and ECHR judgments (real) | 0.90 |
| `03_collective_agreements` | national CCTs (real) + 3 company CCTs (mock) | 0.90 |
| `04_official_guidance` | SPF Emploi, ONSS, APD pages (real) | 0.80 |
| `05_company_policies` (+ `archive/`) | work regulations, handbook, policies; superseded versions in archive | 0.85 / 0.40 |
| `06_contracts` | contracts, amendments, annexes, dismissal letters | 0.85 |
| `07_official_records` | timesheets, badge, VPN, audit and DLP logs, payroll, HRIS, certificate scan | 0.75 |
| `08_investigations` | HR reports, prevention-adviser opinion, legal memos | 0.70 |
| `09_statements` | employee and witness statements | 0.50 |
| `10_emails` | `.eml` threads (+3 unrelated distractor emails) | 0.55 |
| `11_chat_messages` | Teams/WhatsApp exports (JSON) | 0.40 |
| `12_performance` | performance reviews | 0.65 |
| `13_external_secondary` | HR-provider blogs and news (real) | 0.35 |
| `questions/` | the 10 test questions (input for your system) | – |
| `_ground_truth/` | expected answers + conflicts (**do not index**, scoring only) | – |

Every folder has documents for the same 6 themes, so results are easy to judge:

| Theme | Topic |
|---|---|
| T1 | Dismissal / serious cause |
| T2 | Working time and overtime |
| T3 | Telework / cross-border work |
| T4 | Leave and sickness |
| T5 | Harassment / discrimination / retaliation |
| T6 | Email and IT monitoring / privacy |

## `data/manifest.json` – one entry per document

Key fields: `id, path, folder, doc_type, title, language, jurisdiction, date, themes, status, synthetic, related_questions` plus the scores:

- **`credibility_weight`** (0–1): how trustworthy the document is. It is the base weight × adjustment factors, which are listed in `weight_factors`:
  - signed ×1.1
  - system-generated record ×1.1
  - independent statutory procedure ×1.2
  - author has a stake in the outcome ×0.7
  - internal guideline ×0.9
  - draft ×0.6
  - older than 3 years ×0.8
- **`applicability`**: 1.0 for Belgian, EU and ECHR sources; 0.3 for foreign law (comparative value only).
- **`final_weight`** = credibility × applicability. Use it to rank evidence.
- **`legal_rank`**: the Belgian hierarchy of norms (art. 51 of the Law of 5 Dec 1968). A lower number wins when two **rules** conflict. It is `null` for documents that are evidence rather than rules.
  1. law
  2. national CCT
  3. company CCT
  4. individual contract
  5. work regulations
  6. policy or handbook

Keep the two scores separate. A chat can be good evidence of a fact, but it is never a rule. `manifest.csv` has the same data in table form.

## The 10 test questions

Each `questions/Qxx.json` gives the question, **4 focus documents** that contradict each other (with weight and rank), and a list of supporting documents. Answers are in `_ground_truth/Qxx.json`: the `verdict`, the `expected_answer`, the `key_facts`, and each `conflict` with its sides, resolution, winning documents and the reason they win.

| Q | Question | Expected verdict |
|---|---|---|
| Q01 | Valid serious-cause dismissal of Marc Dubois? (3-working-day rule) | likely invalid |
| Q02 | Overtime pay for Sofie Claes ("position of trust")? | entitled |
| Q03 | Can Pieter De Smet work 4 months from Lyon? | not as requested |
| Q04 | Lawful refusal of Lina Haddad's parental leave? | unlawful |
| Q05 | Is the harassment complaint against Bart Willems substantiated? | substantiated |
| Q06 | Could HR/IT read Jan Peeters' mailbox? | not lawful |
| Q07 | Serious cause for a late medical certificate (Luc Schmit)? | no |
| Q08 | Pay for on-call interventions + access to VPN logs (Ahmed Karimi)? | partly yes |
| Q09 | Is Emma's dismissal protected against retaliation? | protected |
| Q10 | Can Lina's rating be lowered because of parental leave? | no |

## How to use it

```bash
# look at one question with its 4 focus docs (text + weights)
python3 examples/load_question.py Q01
python3 examples/load_question.py Q01 --truth        # also show the expected answer

# convert the whole corpus to plain text for indexing (one JSON line per document)
python3 examples/load_question.py --all-text          # -> build/corpus.jsonl
```

Suggested test loop:
1. **Index** `build/corpus.jsonl`, but **exclude `_ground_truth/`**. Chunk the text and keep the `id`, `final_weight`, `legal_rank`, `themes` and `date` as metadata. The corpus is FR/NL/EN, so use a multilingual embedding model.
2. For each question, retrieve documents, rerank them using `final_weight`, and when rules conflict apply `legal_rank`. Also skip superseded versions (`status: superseded`) and apply "more favourable to the employee" where it applies.
3. Have the model output a verdict, the reasons with cited document IDs, and a list of conflicts saying which document wins and why.
4. **Score** each answer against the ground truth:
   - Is the verdict correct?
   - Did it cite the `winning_docs`?
   - Did it find the conflicts?
   - Did it reject the low-weight or superseded documents?

Two modes are worth testing:
- **Focus mode:** give the model only the 4 focus documents. This tests pure conflict reasoning.
- **Retrieval mode:** give it only the question. This tests whether retrieval finds the focus and supporting documents.

## Regenerating

```bash
python3 generator/fetch_real.py      # re-download the real sources (Justel, CELLAR, CNT, ...)
python3 generator/gen_records.py     # regenerate the CSV records (seeded, deterministic)
python3 generator/render.py          # render generator/synth/*.bundle -> data/ (needs LibreOffice, pdftoppm)
python3 generator/build_manifest.py  # weights, questions, ground truth, validation
```

To add a mock document, add an `@@@ FILE <ID>` block with front matter to a `generator/synth/*.bundle` file, then re-run `render.py` and `build_manifest.py`. To change a question or its expected answer, edit `generator/cases.py`. The file `generator/cases.yaml` is generated for reading only.

## Caveats

- The mock documents and people are fictional and made for testing only. The legal analyses in the ground truth are plausible and deliberately debatable. They are not legal advice.
- The Reg. 883/2004 text is the original 2004 version; articles 11–13 were amended later. This is flagged in the manifest.
- In the retaliation-protection law, Justel numbers the article *32terdecies*; the mock documents cite the usual form *32tredecies*.
