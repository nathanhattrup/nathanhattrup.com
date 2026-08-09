#!/usr/bin/env python3
"""Invariant tests for make_gates_data.py (spec §11). Run: python3 -m pytest test_gates_data.py"""

import json
import re
import subprocess
import sys

from make_gates_data import ROWS, branch_fn, build, ev

DATA = build()


def test_invariants():
    """Every emitted puzzle must satisfy every rule. These assertions ARE the spec."""
    p = DATA["puzzles"]

    assert len(p) == 200                                    # locks the space size
    for x in p:
        assert sum(x["nots"]) <= 2                          # max 2 NOTs
        assert not (x["nots"][0] and x["nots"][1])          # top gate not double-NOTted
        assert not (x["nots"][2] and x["nots"][3])          # bottom gate not double-NOTted
        assert len(set(x["q"])) == 2                        # Q never constant
        assert x["c"] != x["d"]                             # branches must differ
        assert len(set(x["c"])) == 2 and len(set(x["d"])) == 2   # neither branch constant

    # every puzzle is its own logical class -- no two share (sorted branches, final gate)
    keys = {(tuple(sorted([tuple(x["c"]), tuple(x["d"])])), x["gates"][2]) for x in p}
    assert len(keys) == 200


def test_self_consistent():
    """Each puzzle's stored c/d/q must actually follow from its own nots and gates.
    Catches a desync between the enumerator and whatever writes the JSON."""
    for x in DATA["puzzles"]:
        na1, nb1, na2, nb2 = x["nots"]
        g1, g2, g4 = x["gates"]
        c = branch_fn(g1, na1, nb1)
        d = branch_fn(g2, na2, nb2)
        q = tuple(ev(g4, a, b) for a, b in zip(c, d))
        assert list(c) == x["c"]
        assert list(d) == x["d"]
        assert list(q) == x["q"]


def test_ids_and_rows():
    """id == list index (index is the day offset from epoch); rows ship as specced."""
    assert DATA["rows"] == [list(r) for r in ROWS]
    assert DATA["count"] == len(DATA["puzzles"])
    for i, x in enumerate(DATA["puzzles"]):
        assert x["id"] == i


def test_epoch_is_set():
    """Guard against shipping the placeholder -- see spec section 5.1."""
    assert DATA["epoch"] != "REPLACE_WITH_LAUNCH_DATE"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", DATA["epoch"])


def test_reproducible():
    """Two fresh runs must match byte for byte -- catches accidental unseeded randomness."""
    a = subprocess.check_output([sys.executable, "make_gates_data.py", "--print"])
    b = subprocess.check_output([sys.executable, "make_gates_data.py", "--print"])
    assert a == b


def test_emitted_file_matches():
    """assets/gates-data.js must carry exactly what build() produces right now."""
    from pathlib import Path
    src = Path(__file__).parent / "assets" / "gates-data.js"
    m = re.search(r"const GATES_DATA = (\{.*\});\n\Z", src.read_text(), re.S)
    assert m, "assets/gates-data.js missing or malformed"
    assert json.loads(m.group(1)) == DATA
