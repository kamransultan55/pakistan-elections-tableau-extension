"""
Builds compact aggregated JSON from the Gallup Pakistan NA elections CSV
(1970-2024) for the web dashboard. Run with: python build_data.py
"""
import csv
import json
import os
from collections import defaultdict

SRC = r"C:\Users\A\Downloads\gallup-pakistan-elections-database-1970-2024-national-assembly.csv"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUT_FILE = os.path.join(OUT_DIR, "elections.json")

PARTY_GROUP_COLOR = {
    "PTI": "#01411C",
    "PPP (s)/PDA": "#E4002B",
    "PML (s)/IJI/PNA": "#0B6E4F",
    "Religious Parties": "#1B4D3E",
    "Province Parties": "#C9A227",
    "Independent Parties": "#6B7280",
    "Other Parties": "#9CA3AF",
}

RAW_PARTY_COLOR = {
    "PPP": "#E4002B",
    "PPPP": "#E4002B",
    "PML-N": "#015B33",
    "PML(N)": "#015B33",
    "PML-Q": "#1F8A4C",
    "PML-Q (Q)": "#1F8A4C",
    "PTI": "#DF1E1E",
    "MQM": "#D4A017",
    "MQM-P": "#D4A017",
    "ANP": "#D32F2F",
    "JUI-F": "#2E7D32",
    "JUI": "#2E7D32",
    "JI": "#0D47A1",
    "BNP": "#6D4C41",
    "IND": "#8A8F98",
    "IND (PTI)": "#F2994A",
    "IJI": "#3F9142",
    "Pakistan Muslim League(QA)": "#2F9E58",
    "Muttahidda Majlis-e-Amal Pakistan": "#1565C0",
    "PDA": "#C23047",
}

def to_float(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except ValueError:
        return None

def main():
    years_set = set()
    provinces_set = set()
    six_groups_set = set()

    # seat_key -> list of candidate rows
    seats = defaultdict(list)
    # (year) -> set of provinces touched, for national rollups
    national_by_year = defaultdict(lambda: {"registered": 0.0, "votes": 0.0, "rejected": 0.0, "seats": set(), "parties": set()})

    with open(SRC, encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            year = row.get("Year", "").strip()
            if not year:
                continue
            years_set.add(year)
            constituency = row.get("Constituency", "").strip()
            na = row.get("NA", "").strip()
            province = row.get("Province", "").strip()
            district = row.get("District", "").strip()
            division = row.get("Division", "").strip()
            party = row.get("Party", "").strip()
            candidate = row.get("Candidate Name", "").strip()
            six = row.get("Six Parties", "").strip()
            regions5 = row.get("Regions 5", "").strip()
            registered = to_float(row.get("Registered Voters"))
            rejected = to_float(row.get("Rejected Votes"))
            turnout = to_float(row.get("Turnout N"))
            votes = to_float(row.get("Votes")) or 0.0

            if province:
                provinces_set.add(province)
            if six:
                six_groups_set.add(six)

            seat_key = (year, na or constituency)
            seats[seat_key].append({
                "constituency": constituency,
                "na": na,
                "province": province,
                "district": district,
                "division": division,
                "regions5": regions5,
                "party": party,
                "candidate": candidate,
                "six": six,
                "votes": votes,
                "registered": registered,
                "rejected": rejected,
                "turnout": turnout,
            })

    # ---- Derive winners per seat, national + province + party rollups ----
    year_national = {y: {"registered": 0.0, "votes_cast": 0.0, "rejected": 0.0, "seats": 0, "turnout_sum": 0.0, "turnout_n": 0, "parties": set()} for y in years_set}
    year_party_seats = defaultdict(lambda: defaultdict(int))          # year -> party -> seats won
    year_sixgroup_seats = defaultdict(lambda: defaultdict(int))        # year -> six-group -> seats won
    year_province_party_seats = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # year -> province -> party -> seats
    party_total_seats = defaultdict(int)
    sixgroup_total_seats = defaultdict(int)
    seat_rows = []  # flattened winner rows for constituency explorer

    for (year, na_key), candidates in seats.items():
        if not candidates:
            continue
        candidates_sorted = sorted(candidates, key=lambda c: c["votes"], reverse=True)
        winner = candidates_sorted[0]
        runner_up = candidates_sorted[1] if len(candidates_sorted) > 1 else None

        province = winner["province"]
        seat_votes_total = sum(c["votes"] for c in candidates)

        # registered/turnout/rejected are usually attached to one row (often the top one); take max non-null across the group
        reg_vals = [c["registered"] for c in candidates if c["registered"]]
        rej_vals = [c["rejected"] for c in candidates if c["rejected"]]
        turn_vals = [c["turnout"] for c in candidates if c["turnout"]]
        registered = max(reg_vals) if reg_vals else None
        rejected = max(rej_vals) if rej_vals else None
        turnout = max(turn_vals) if turn_vals else (round(seat_votes_total / registered * 100, 2) if registered else None)

        yn = year_national[year]
        if registered:
            yn["registered"] += registered
        yn["votes_cast"] += seat_votes_total
        if rejected:
            yn["rejected"] += rejected
        yn["seats"] += 1
        if turnout:
            yn["turnout_sum"] += turnout
            yn["turnout_n"] += 1
        for c in candidates:
            if c["party"]:
                yn["parties"].add(c["party"])

        if winner["party"]:
            year_party_seats[year][winner["party"]] += 1
            party_total_seats[winner["party"]] += 1
        if winner["six"]:
            year_sixgroup_seats[year][winner["six"]] += 1
            sixgroup_total_seats[winner["six"]] += 1
        if province and winner["party"]:
            year_province_party_seats[year][province][winner["party"]] += 1

        margin = None
        margin_pct = None
        if runner_up:
            margin = winner["votes"] - runner_up["votes"]
            if seat_votes_total:
                margin_pct = round(margin / seat_votes_total * 100, 2)

        seat_rows.append({
            "year": year,
            "constituency": winner["constituency"],
            "na": na_key,
            "province": province,
            "district": winner["district"],
            "division": winner["division"],
            "winner_party": winner["party"],
            "winner_candidate": winner["candidate"],
            "winner_votes": winner["votes"],
            "runner_up_party": runner_up["party"] if runner_up else None,
            "runner_up_votes": runner_up["votes"] if runner_up else None,
            "margin": margin,
            "margin_pct": margin_pct,
            "turnout": round(turnout, 2) if turnout else None,
            "registered": registered,
            "candidates_count": len(candidates),
        })

    years_sorted = sorted(years_set, key=lambda y: int(y))

    national_trend = []
    for y in years_sorted:
        yn = year_national[y]
        avg_turnout = round(yn["turnout_sum"] / yn["turnout_n"], 2) if yn["turnout_n"] else None
        computed_turnout = round(yn["votes_cast"] / yn["registered"] * 100, 2) if yn["registered"] else None
        national_trend.append({
            "year": y,
            "seats": yn["seats"],
            "registered_voters": round(yn["registered"]),
            "votes_cast": round(yn["votes_cast"]),
            "rejected_votes": round(yn["rejected"]),
            "turnout_pct": avg_turnout if avg_turnout else computed_turnout,
            "parties_contested": len(yn["parties"]),
        })

    # Six-party-group seat share over time (stable categories across decades)
    six_groups_sorted = sorted(six_groups_set)
    sixgroup_trend = {
        "years": years_sorted,
        "groups": six_groups_sorted,
        "colors": {g: PARTY_GROUP_COLOR.get(g, "#888888") for g in six_groups_sorted},
        "series": {g: [year_sixgroup_seats[y].get(g, 0) for y in years_sorted] for g in six_groups_sorted},
    }

    # Top parties all-time by seats won (raw party names) -> top 10 + Others
    top_parties_sorted = sorted(party_total_seats.items(), key=lambda kv: kv[1], reverse=True)
    top_n = 10
    top_parties = top_parties_sorted[:top_n]
    others_total = sum(v for _, v in top_parties_sorted[top_n:])
    top_parties_all_time = [{"party": p, "seats": s, "color": RAW_PARTY_COLOR.get(p, "#7c8696")} for p, s in top_parties]
    if others_total:
        top_parties_all_time.append({"party": "Others", "seats": others_total, "color": "#4b5563"})

    # Province x year x party seat matrix (for the province explorer, keyed by year)
    province_year = {}
    for y in years_sorted:
        province_year[y] = {
            prov: dict(parties) for prov, parties in year_province_party_seats[y].items()
        }

    provinces_sorted = sorted(p for p in provinces_set if p)

    payload = {
        "meta": {
            "source": "Gallup Pakistan Elections Database 1970-2024 (National Assembly)",
            "years": years_sorted,
            "provinces": provinces_sorted,
            "seat_count_latest": year_national[years_sorted[-1]]["seats"] if years_sorted else 0,
            "total_rows": sum(len(v) for v in seats.values()),
        },
        "national_trend": national_trend,
        "sixgroup_trend": sixgroup_trend,
        "top_parties_all_time": top_parties_all_time,
        "province_year_party_seats": province_year,
        "seats": seat_rows,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f"Wrote {OUT_FILE} ({size_kb:.1f} KB)")
    print(f"Years: {years_sorted}")
    print(f"Provinces: {provinces_sorted}")
    print(f"Total seat-records: {len(seat_rows)}")

if __name__ == "__main__":
    main()
