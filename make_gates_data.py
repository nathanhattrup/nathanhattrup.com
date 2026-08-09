#!/usr/bin/env python3
"""Regenerate assets/gates-data.js — the 200 logically unique Gates circuits.

Fully deterministic: same rules always produce the same file on any machine.
Run once (output is committed; rerun only if the ruleset ever changes):

    python3 make_gates_data.py            # writes assets/gates-data.js
    python3 make_gates_data.py --print    # raw JSON to stdout (used by tests)

Spec: gates-backend-spec.md. EPOCH is the launch date and must never change
after launch — changing it remaps every past date's puzzle and corrupts all
stored history and share strings (spec §5.1).
"""

import json
import random
import sys
from collections import Counter
from itertools import product
from pathlib import Path

ROOT = Path(__file__).parent
OUT_PATH = ROOT / "assets" / "gates-data.js"

GATES = ["AND", "NAND", "OR", "NOR", "XOR", "XNOR"]
ROWS = [(0, 0), (0, 1), (1, 0), (1, 1)]   # truth-table row order, MSB = A
SHUFFLE_SEED = 20260101                    # frozen: changing this reorders every future puzzle
EPOCH = "2026-08-09"                       # launch date; puzzle id 0 plays on this local date


def ev(gate, x, y):
    """Evaluate one 2-input gate on bits x, y. Returns 0 or 1."""
    return {
        "AND":  x & y,
        "NAND": 1 - (x & y),
        "OR":   x | y,
        "NOR":  1 - (x | y),
        "XOR":  x ^ y,
        "XNOR": 1 - (x ^ y),
    }[gate]


def branch_fn(gate, na, nb):
    """The 4-bit column one #2 branch produces -- i.e. the C or D column.

    XOR with the NOT flag is the inverter: A ^ 1 == NOT A, A ^ 0 == A.
    Comparing branches by this function rather than by gate symbol is what collapses
    equivalent drawings (notably A XOR (NOT B) == A XNOR B) into a single class.
    """
    return tuple(ev(gate, A ^ na, B ^ nb) for A, B in ROWS)


def enumerate_classes():
    """Group every legal drawing by its logical class. Returns {class_key: [drawings]}."""
    classes = {}
    for na1, nb1, na2, nb2 in product([0, 1], repeat=4):
        if na1 + nb1 + na2 + nb2 > 2:
            continue                                   # rule: max 2 NOTs total
        if (na1 and nb1) or (na2 and nb2):
            continue                                   # rule: no #2 gate has both inputs NOTted
        for g1, g2 in product(GATES, repeat=2):        # no NAND/NOR cap -- deliberately removed
            for g4 in GATES:
                c, d = branch_fn(g1, na1, nb1), branch_fn(g2, na2, nb2)
                q = tuple(ev(g4, x, y) for x, y in zip(c, d))
                if q in [(0, 0, 0, 0), (1, 1, 1, 1)]:
                    continue                           # rule: Q must not be constant
                if c == d:
                    continue                           # rule: C and D must differ (spec 2.3)
                # The #4 gate is commutative, so branch order carries no information.
                # Sorting the two columns makes the key order-independent, which is what
                # collapses a circuit and its vertical mirror into one class.
                key = (tuple(sorted([c, d])), g4)
                classes.setdefault(key, []).append({
                    "nots": [na1, nb1, na2, nb2],      # [A→top, B→top, A→bottom, B→bottom]
                    "gates": [g1, g2, g4],             # [top #2, bottom #2, final #4]
                    "c": list(c), "d": list(d), "q": list(q),
                })
    return classes


def pick_representatives(classes):
    """Choose one drawing per class: fewest NOTs, tie-broken to level gate usage.

    An alphabetical tiebreak hands every tie to AND and NAND, leaving OR and NOR badly
    under-represented. Iterating scarcest-class-first keeps this deterministic while
    letting constrained classes choose before common ones consume the quota.
    """
    usage, out = Counter(), []
    for key in sorted(classes, key=lambda k: (len(classes[k]), k)):
        drawings = classes[key]
        fewest = min(sum(dr["nots"]) for dr in drawings)
        pool = [dr for dr in drawings if sum(dr["nots"]) == fewest]
        pick = min(pool, key=lambda dr: (sum(usage[g] for g in dr["gates"]), dr["gates"]))
        usage.update(pick["gates"])
        out.append(pick)
    return out


def difficulty(drawing):
    """Heuristic 0-5: one point per NOT, per inverting gate, per XOR. Unvalidated --
    used only for internal balance checks, never shown to the player."""
    gates = drawing["gates"]
    return (sum(drawing["nots"])
            + sum(g in {"NAND", "NOR", "XNOR"} for g in gates)
            + sum(g == "XOR" for g in gates))


def build():
    """The full data payload, exactly as it ships."""
    puzzles = pick_representatives(enumerate_classes())
    # Shuffle once with the frozen seed, then serve strictly in order. Guarantees every
    # puzzle is used exactly once before any repeat, which hash-modulo cannot promise.
    random.Random(SHUFFLE_SEED).shuffle(puzzles)
    for i, p in enumerate(puzzles):
        p["id"] = i                                    # index == day offset from EPOCH
        p["difficulty"] = difficulty(p)
    return {
        "version": 4,
        "epoch": EPOCH,                                # puzzle id 0 is played on this local date
        "rows": [list(r) for r in ROWS],               # client never hardcodes row order
        "count": len(puzzles),
        "puzzles": puzzles,
    }


def main():
    payload = json.dumps(build(), separators=(",", ":"))
    if "--print" in sys.argv[1:]:
        print(payload)
        return
    OUT_PATH.write_text(
        "// GENERATED FILE — do not edit by hand.\n"
        "// Rebuild with: python3 make_gates_data.py  (see gates-backend-spec.md)\n"
        "// EPOCH is the launch date and must NEVER change after launch (spec §5.1).\n"
        f"const GATES_DATA = {payload};\n"
    )
    data = json.loads(payload)
    print(f"Wrote {data['count']} puzzles to {OUT_PATH} (epoch {data['epoch']})")


if __name__ == "__main__":
    main()
