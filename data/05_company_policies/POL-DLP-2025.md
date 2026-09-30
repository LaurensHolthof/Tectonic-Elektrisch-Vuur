# DLP Standard (June 2025)

## Scope
Microsoft 365 DLP policies on e-mail, OneDrive, SharePoint and endpoint (browser uploads).

## Detection rules
- R1: upload of files labelled *Confidential* to non-corporate cloud storage.
- R2: e-mail forwarding of *Confidential* files to external private domains (gmail.com, hotmail.com, outlook.com, ...).
- R3: export of > 1,000 CRM records within 24 h.

## Escalation
1. Alert reviewed by IT Security within 1 working day.
2. Confirmed high-severity alerts are **reported to the HR Director and the employee's line manager within 24 hours**, with the evidence (file names, timestamps, destination).
3. HR decides on further steps. IT Security does not contact the employee.

## Evidence
Only DLP metadata (who, what, when, where) is used for the alert. Access to mailbox **content** requires a separate written request of the HR Director and must follow the CCT 81 individualisation procedure.

---
*Synthetic document – Tectonic 2026 hackathon dataset. Company, people and events are fictional.*
