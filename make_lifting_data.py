#!/usr/bin/env python3
"""Regenerate assets/lifting-data.js from assets/nathanhattrup.csv.

The CSV is the raw OpenPowerlifting export (plus any manually added rows).
Run after updating the CSV:

    python3 make_lifting_data.py
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).parent
CSV_PATH = ROOT / "assets" / "nathanhattrup.csv"
OUT_PATH = ROOT / "assets" / "lifting-data.js"


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def attempts(row, lift):
    """Recorded attempts in order; misses stay negative (OpenPowerlifting convention)."""
    vals = [num(row.get(f"{lift}{i}Kg")) for i in range(1, 5)]
    return [v for v in vals if v is not None]


def main():
    meets = []
    with open(CSV_PATH, newline="") as f:
        for row in csv.DictReader(f):
            if not row.get("Date"):
                continue
            meets.append({
                "date": row["Date"],
                "meet": row.get("MeetName") or "TBD",
                "bodyweight": num(row.get("BodyweightKg")),
                "squat": num(row.get("Best3SquatKg")),
                "bench": num(row.get("Best3BenchKg")),
                "deadlift": num(row.get("Best3DeadliftKg")),
                "total": num(row.get("TotalKg")),
                "dots": num(row.get("Dots")),
                "squatAttempts": attempts(row, "Squat"),
                "benchAttempts": attempts(row, "Bench"),
                "deadliftAttempts": attempts(row, "Deadlift"),
            })

    meets.sort(key=lambda m: m["date"])

    lines = [
        "// GENERATED FILE — do not edit by hand.",
        "// Source: assets/nathanhattrup.csv. Rebuild with: python3 make_lifting_data.py",
        "// All lift numbers are kg; dots is unitless.",
        "const LIFTING_MEETS = [",
    ]
    for m in meets:
        lines.append("  " + json.dumps(m) + ",")
    lines.append("];")
    OUT_PATH.write_text("\n".join(lines) + "\n")
    print(f"Wrote {len(meets)} meets to {OUT_PATH}")


if __name__ == "__main__":
    main()
