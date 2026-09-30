"""Generate the tabular official records (CSV) as synth/07_records_generated.bundle.

Deterministic (seeded) so the numbers quoted in cases.yaml and the ground truth stay valid.
Prints the key totals used in the ground truth.
"""
import csv
import io
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent / "synth" / "07_records_generated.bundle"
R = random.Random(2026)
HOLIDAYS_2026 = {date(2026, 1, 1), date(2026, 4, 6), date(2026, 5, 1), date(2026, 5, 14), date(2026, 5, 25)}


def fm(doc_id, **k):
    lines = [f"@@@ FILE {doc_id}", "---"]
    for key, v in k.items():
        lines.append(f"{key}: {v}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def to_csv(rows, header):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)
    w.writerows(rows)
    return buf.getvalue()


def days(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def hm(hours):
    return f"{int(hours):02d}:{int(round((hours % 1) * 60)):02d}"


# --------------------------------------------------------------------------- Q02 Sofie
def sofie():
    weekend_worked = {date(2026, 1, 24), date(2026, 1, 25), date(2026, 2, 28), date(2026, 3, 14), date(2026, 3, 15),
                      date(2026, 3, 28), date(2026, 4, 18), date(2026, 5, 9), date(2026, 5, 30), date(2026, 6, 13),
                      date(2026, 6, 14)}
    leave = set(days(date(2026, 2, 16), date(2026, 2, 20))) | {date(2026, 5, 15), date(2026, 5, 26), date(2026, 5, 27)}
    office_days = {1, 2, 3}  # Tue-Thu at the Antwerp office; Mon/Fri telework
    projects = ["PRJ-2231 Antwerp Port Data Lake", "PRJ-2240 Brabo Retail BI", "PRJ-2254 Scheldt Energy Migration"]
    ts, badge, weekly = [], [], {}
    for d in days(date(2026, 1, 1), date(2026, 6, 30)):
        wd = d.weekday()
        if d in HOLIDAYS_2026:
            ts.append([d.isoformat(), d.strftime("%a"), "", "0.00", "public holiday", "validated"])
            continue
        if d in leave:
            ts.append([d.isoformat(), d.strftime("%a"), "", "0.00", "annual leave", "validated"])
            continue
        if wd >= 5 and d not in weekend_worked:
            continue
        if wd >= 5:
            h = round(R.uniform(5.0, 8.0) * 4) / 4
            loc = "office" if d.weekday() == 5 and R.random() < 0.5 else "home"
            note = "weekend go-live / delivery"
        else:
            base = R.uniform(8.75, 10.25)
            if R.random() < 0.12:
                base = R.uniform(7.6, 8.25)
            h = round(base * 4) / 4
            loc = "office" if wd in office_days else "home"
            note = ""
        proj = projects[(d.toordinal() // 9) % 3]
        start = 8.0 + R.choice([0, 0.25, 0.5, 0.75])
        ts.append([d.isoformat(), d.strftime("%a"), proj, f"{h:.2f}", note or loc, "validated"])
        if loc == "office":
            end = start + h + 0.5  # 30 min lunch
            badge.append([d.isoformat(), "E1057", "ANT-MAIN-IN", f"{d.isoformat()} {hm(start - R.uniform(0, 0.15))}"])
            badge.append([d.isoformat(), "E1057", "ANT-MAIN-OUT", f"{d.isoformat()} {hm(end + R.uniform(0, 0.2))}"])
        wk = d.isocalendar()[:2]
        weekly[wk] = weekly.get(wk, 0) + h
    # compute overtime above 38h/week for full weeks without leave/holiday reduction
    ot_total, sunday_h = 0.0, 0.0
    for row in ts:
        d = date.fromisoformat(row[0])
        if d.weekday() == 6 and float(row[3]) > 0:
            sunday_h += float(row[3])
    worked_weeks = []
    for (y, w), h in sorted(weekly.items()):
        mon = date.fromisocalendar(y, w, 1)
        absent = sum(1 for i in range(5) if (mon + timedelta(i)) in HOLIDAYS_2026 | leave)
        norm = 38 - absent * 7.6
        ot_total += max(0, h - norm)
        if absent == 0:
            worked_weeks.append(h)
    avg = sum(worked_weeks) / len(worked_weeks)
    print(f"Q02 Sofie: overtime above normal weekly hours = {ot_total:.1f} h; average full week = {avg:.1f} h; "
          f"weekend days = {len(weekend_worked)}; Sunday hours = {sunday_h:.1f}")
    payroll = []
    for m in range(1, 7):
        payroll.append([f"2026-{m:02d}", "E1057", "Sofie Claes", "4553.00", "0.00", "0.00", str(R.randint(19, 21)),
                        "M1 – position of trust (no overtime)"])
    return ts, badge, payroll, ot_total, avg


# --------------------------------------------------------------------------- Q08 Ahmed
def ahmed():
    oncall_weeks = [date(2026, 4, 6), date(2026, 4, 27), date(2026, 5, 25), date(2026, 6, 22)]
    durations = [0.5, 0.75, 0.75, 0.5, 0.9, 0.6, 0.75, 0.5, 0.8,               # 9 short (< 60 min)
                 1.5, 2.0, 1.75, 2.5, 3.0, 1.25, 2.25, 4.0, 1.5, 2.75, 3.5, 2.0, 2.4, 2.5]  # 14 long
    R.shuffle(durations)
    total = sum(durations)
    # scale to exactly 41.5 h
    scale = 41.5 / total
    durations = [round(x * scale * 20) / 20 for x in durations]
    diff = round(41.5 - sum(durations), 2)
    durations[-1] = round(durations[-1] + diff, 2)
    rows, iv, k = [], [], 0
    per_week = [6, 5, 6, 6]
    for wk, n in zip(oncall_weeks, per_week):
        slots = sorted(R.sample(range(0, 7 * 24 - 10), n * 3))[::3][:n]
        for s in slots:
            dur = durations[k]
            k += 1
            day = wk + timedelta(days=s // 24)
            hour = [19, 20, 21, 22, 23, 0, 1, 2, 5, 6][s % 10]
            if day.weekday() < 5 and 8 <= hour < 18:
                hour = 21
            start = datetime(day.year, day.month, day.day, hour, R.randint(0, 59))
            if hour < 7:
                start += timedelta(days=1)
            end = start + timedelta(hours=dur)
            ticket = f"INC-{21800 + k * 7}"
            rows.append([start.strftime("%Y-%m-%d %H:%M:%S"), end.strftime("%Y-%m-%d %H:%M:%S"), "a.karimi",
                         f"81.{R.randint(240, 247)}.{R.randint(0, 255)}.x", "GlobalProtect-BXL",
                         f"{int(dur * 60)}", f"{R.randint(40, 900)} MB", ticket])
            iv.append((start, dur, ticket))
    # daytime telework sessions for realism
    for wk in oncall_weeks:
        for i in (0, 2):
            d = wk + timedelta(days=i)
            if d in HOLIDAYS_2026:
                continue
            s = datetime(d.year, d.month, d.day, 8, R.randint(30, 59))
            e = s + timedelta(hours=8, minutes=R.randint(10, 40))
            rows.append([s.strftime("%Y-%m-%d %H:%M:%S"), e.strftime("%Y-%m-%d %H:%M:%S"), "a.karimi",
                         f"81.{R.randint(240, 247)}.{R.randint(0, 255)}.x", "GlobalProtect-BXL",
                         str(int((e - s).total_seconds() // 60)), f"{R.randint(300, 2500)} MB", "telework day"])
    rows.sort()
    short = sum(1 for _, d, _ in iv if d < 1)
    beyond = sum(max(0, d - 1) for _, d, _ in iv)
    print(f"Q08 Ahmed: {len(iv)} interventions, {sum(d for _, d, _ in iv):.2f} h active; "
          f"{short} shorter than 60 min; policy-compensable (beyond first 60 min) = {beyond:.2f} h")
    ts = []
    for wk in oncall_weeks:
        wk_iv = [d for s, d, _ in iv if wk <= s.date() < wk + timedelta(days=8)]
        orig = 38 + sum(wk_iv)
        ts.append([f"{wk.isoformat()}", "E1102", f"{orig:.2f}", "38.00", "n.hubert",
                   "adjusted – not approved (stand-by covered by allowance)"])
    return rows, ts, iv


# --------------------------------------------------------------------------- Q10 Lina KPIs
def lina_kpis():
    team = [("E1071", "Lina Haddad"), ("E1120", "Maxime Renard"), ("E1121", "Chloé Dethier"),
            ("E1122", "Sam Kaya"), ("E1123", "Aurélie Gilson"), ("E1124", "Noah Lejeune")]
    rows = []
    months = [(1, 21), (2, 20), (3, 22), (4, 21), (5, 18), (6, 22)]
    lina_out, lina_days, other_out, other_days = 0, 0, 0, 0
    for m, wdays in months:
        for eid, name in team:
            wd = wdays - R.randint(0, 2)
            if eid == "E1071" and m == 6:
                wd = round(wdays * 0.8)  # 4/5 from June
            rate = 1.28 if eid == "E1071" else R.uniform(0.92, 1.18)
            out = round(rate * wd)
            rows.append([f"2026-{m:02d}", eid, name, str(wd), str(out), f"{out / wd:.2f}",
                         str(R.randint(2, 6)), f"{R.uniform(3.1, 4.9):.1f}"])
            if eid == "E1071":
                lina_out, lina_days = lina_out + out, lina_days + wd
            else:
                other_out, other_days = other_out + out, other_days + wd
    print(f"Q10 Lina: output/day {lina_out / lina_days:.2f} vs team others {other_out / other_days:.2f}")
    return rows, lina_out / lina_days, other_out / other_days


def main():
    parts = []
    ts, badge, payroll, ot, avg = sofie()
    parts.append(fm("REC-Q02-01", folder="07_official_records", format="csv",
                    title="'Timesheet export H1 2026 – Sofie Claes (E1057)'", doc_type="timesheet",
                    author="Timesheet tool (TimeTrack) – export by HR", author_role="system_record", date="2026-07-06",
                    jurisdiction="BE", language="en", themes="[T2]", status="final", signed="false",
                    formality="system_record", related_employees="[E1057, E1011]", related_questions="[Q02]")
                 + to_csv(ts, ["date", "weekday", "project", "hours", "note_location", "manager_validation"]))
    parts.append(fm("REC-Q02-02", folder="07_official_records", format="csv",
                    title="'Badge access log Antwerp office H1 2026 – E1057'", doc_type="badge_log",
                    author="Access control system (Facility)", author_role="system_record", date="2026-07-06",
                    jurisdiction="BE", language="en", themes="[T2]", status="final", signed="false",
                    formality="system_record", related_employees="[E1057]", related_questions="[Q02]")
                 + to_csv(badge, ["date", "employee_id", "reader", "timestamp"]))
    parts.append(fm("REC-Q02-03", folder="07_official_records", format="csv",
                    title="'Payroll summary H1 2026 – Sofie Claes'", doc_type="payroll",
                    author="Paycore Social Secretariat", author_role="system_record", date="2026-07-02",
                    jurisdiction="BE", language="en", themes="[T2]", status="final", signed="false",
                    formality="system_record", related_employees="[E1057]", related_questions="[Q02]")
                 + to_csv(payroll, ["period", "employee_id", "name", "gross_base_eur", "overtime_hours_paid",
                                    "overtime_premium_eur", "meal_vouchers", "payroll_category"]))
    vpn, ahmed_ts, iv = ahmed()
    parts.append(fm("REC-Q08-01", folder="07_official_records", format="csv",
                    title="'VPN connection log (GlobalProtect) – a.karimi – on-call weeks Apr–Jun 2026'",
                    doc_type="security_log", author="IT Security – GlobalProtect gateway", author_role="system_record",
                    date="2026-07-10", jurisdiction="BE", language="en", themes="[T2, T6]", status="final",
                    signed="false", formality="system_record", related_employees="[E1102, E1005]",
                    related_questions="[Q08]")
                 + to_csv(vpn, ["session_start", "session_end", "user", "source_ip_masked", "gateway",
                                "duration_min", "data_transferred", "linked_ticket"]))
    parts.append(fm("REC-Q08-02", folder="07_official_records", format="csv",
                    title="'Timesheet corrections log – on-call weeks – Ahmed Karimi'", doc_type="timesheet",
                    author="Timesheet tool (TimeTrack) – audit trail", author_role="system_record", date="2026-07-01",
                    jurisdiction="BE", language="en", themes="[T2]", status="final", signed="false",
                    formality="system_record", related_employees="[E1102, E1016]", related_questions="[Q08]")
                 + to_csv(ahmed_ts, ["week_starting", "employee_id", "hours_entered_by_employee",
                                     "hours_after_correction", "corrected_by", "correction_comment"]))
    kpi, lina_rate, team_rate = lina_kpis()
    parts.append(fm("REC-Q10-01", folder="07_official_records", format="csv",
                    title="'Marketing KPI export Jan–Jun 2026 – Liège team'", doc_type="kpi_export",
                    author="Marketing automation platform – export by HR", author_role="system_record",
                    date="2026-07-20", jurisdiction="BE", language="en", themes="[T4, T5]", status="final",
                    signed="false", formality="system_record", related_employees="[E1071, E1013]",
                    related_questions="[Q10]")
                 + to_csv(kpi, ["month", "employee_id", "name", "days_worked", "campaign_deliverables",
                                "deliverables_per_worked_day", "campaigns_led", "stakeholder_score_5"]))
    OUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"written {OUT}")


if __name__ == "__main__":
    main()
