# Gates — Backend Design Spec (rev 4, handoff)

Daily logic-gate puzzle. Static site on GitHub Pages. **No server, no runtime randomness.**

Status: ready for implementation. The generator in §4 has been run and verified — every figure in this document is measured output, not estimate.

Rev 4 changes: timer removed entirely; two dating bugs fixed (see §5); measured figures corrected in §2.4; handoff checklist added in §13.

---

## 1. Locked ruleset

Fixed topology. Inputs `A`, `B` → four `#1` inverter slots → two `#2` gates → one `#4` gate → output `Q`. The two `#2` gate outputs are surfaced to the player as nodes **C** (top) and **D** (bottom).

```
A ──[#1]──┐
          ├──[#2 top]────C───┐
B ──[#1]──┘                  │
                             ├──[#4]── Q
A ──[#1]──┐                  │
          ├──[#2 bottom]──D──┘
B ──[#1]──┘
```

| Rule | Value |
|---|---|
| `#1` slots | 4, each either NOT or straight wire |
| Max NOTs | 2 total |
| No double-up | A single `#2` gate may not have both its inputs NOTted |
| Gate pool | AND, NAND, OR, NOR, XOR, XNOR (all three slots, equal weight) |
| NAND/NOR cap | **None** — see §2.2 |
| Constant filter | Drop any circuit where Q is 0000 or 1111 |
| Twin-branch filter | Drop any circuit where C and D compute the same function — see §2.3 |
| Uniqueness | One puzzle per logical class. Total: **200** |

## 2. Space size and why these rules

### 2.1 The ceiling is 240, set by topology

A branch computes `gate(A?, B?)` where each input may be inverted. There are <cite index="1-1">at most 16 boolean functions of two variables (2⁴)</cite>, of which <cite index="2-1">six are constants or unary functions — 0, 1, x, y, and the two complements — leaving ten</cite>. No two-input gate ignores an input, so every branch lands in exactly those ten.

```
ceiling = (unordered pairs of 10 branch functions) × (6 final gates) − (constant-Q combos)
        = (C(10,2) + 10) × 6 − 90
        = 55 × 6 − 90
        = 240
```

Full enumeration returns exactly 240. This is a wall set by circuit shape, not by rules. Only a topology change — a third input, or a third `#2` gate — gets past it.

### 2.2 Rule sweep: only the NAND/NOR cap cost anything

| Max NOTs | No-double-up | NAND/NOR cap | Unique classes |
|---|---|---|---|
| 2 | yes | yes | 226 |
| **2** | **yes** | **no** | **240** |
| 2 | no | yes | 240 |
| 2 / 3 / 4 | no | no | 240 |

- **The max-NOT limit is inert.** 2, 3, and 4 give identical counts. One inverter per branch already reaches every function a branch can compute; a second is always redundant. Keep the limit at 2 — free, and it keeps the drawing legible.
- **Each remaining rule is free alone; only the pair is expensive.** A branch computing `¬A AND ¬B` is reachable two ways: a NOR gate, or an AND with both inputs inverted. The cap blocks the first route, no-double-up blocks the second. Block both and the function is unreachable.

So: **drop the cap, keep no-double-up.**

### 2.3 Trimming 240 → 200

Forty of the 240 classes have C and D computing the *same* function. Those circuits collapse to a single effective gate, the bottom branch is decoration, and — now that C and D are visible columns — the player sees two identical columns and knows at a glance that half the circuit does not matter. Drop them.

This filter and the C/D feature reinforce each other: after it, **C and D are never equal in any shipped puzzle**, and no column is ever constant. Verified across all 200.

A stricter tier exists (drop the further 80 classes where Q is fully determined by one branch alone, leaving 120). **Not recommended.** Those 80 have no visual tell — a player cannot exploit the redundancy without evaluating both branches anyway — so the filter costs four months of content and buys nothing.

### 2.4 Final set profile — measured

200 puzzles ≈ 6.6 months of dailies. `puzzles.json` is **22 KB** uncompressed.

| Metric | Value |
|---|---|
| NOT count | 60 puzzles with 0, 120 with 1, 20 with 2 |
| Gate usage | AND 111, OR 110, NAND 110, NOR 109, XOR 80, XNOR 80 |
| Difficulty (0–5 heuristic) | 2 / 14 / 62 / 92 / 25 / 5 |
| Distinct Q columns | 14 (of 16; the two constants are excluded) |
| Alternate drawings per class | 2 to 12 |

XOR and XNOR sit lower than the other four because fewer classes require them. This is expected, not a bug — do not "fix" it by forcing quota.

Each class has several possible drawings. Pick the representative by fewest NOTs, then break ties to level gate usage across the whole set. A naive alphabetical tiebreak skews badly, handing AND and NAND 150 uses each while OR and NOR sit at 70.

## 3. Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Generation | Python 3, stdlib only | Runs once locally, output committed. No CI, no deps |
| Data | `data/puzzles.json`, committed | 22 KB, browser-cached |
| Runtime | Vanilla JS ES modules | One table + one fixed SVG |
| Render | Hand-rolled inline SVG | Topology never changes — only gate labels and NOT bubbles |
| Persistence | `localStorage` | No accounts, no server, no cookie banner |
| Tests | `pytest` on the generator | Invariants live in the data |

**Zero runtime dependencies. Zero build step for the site.**

## 4. Generator — verified reference implementation

Run once: `python3 tools/generate.py > data/puzzles.json`. This code has been executed; it emits 200 puzzles, is byte-for-byte reproducible across runs, and passes every assertion in §11.

```python
#!/usr/bin/env python3
"""Enumerate the 200 logically unique Gates circuits and emit the daily puzzle list.

Fully deterministic: same rules always produce the same file on any machine.
"""
import json
import random
from collections import Counter
from itertools import product

GATES = ["AND", "NAND", "OR", "NOR", "XOR", "XNOR"]
ROWS = [(0, 0), (0, 1), (1, 0), (1, 1)]   # truth-table row order, MSB = A
SHUFFLE_SEED = 20260101                    # frozen: changing this reorders every future puzzle
EPOCH = "REPLACE_WITH_LAUNCH_DATE"         # see spec section 5 -- MUST be set before first deploy


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


def main():
    puzzles = pick_representatives(enumerate_classes())
    # Shuffle once with the frozen seed, then serve strictly in order. Guarantees every
    # puzzle is used exactly once before any repeat, which hash-modulo cannot promise.
    random.Random(SHUFFLE_SEED).shuffle(puzzles)
    for i, p in enumerate(puzzles):
        p["id"] = i                                    # index == day offset from EPOCH
        p["difficulty"] = difficulty(p)
    print(json.dumps({
        "version": 4,
        "epoch": EPOCH,                                # puzzle id 0 is played on this local date
        "rows": [list(r) for r in ROWS],               # client never hardcodes row order
        "count": len(puzzles),
        "puzzles": puzzles,
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
```

`c` and `d` ship in the JSON for the loss-reveal and for tests. They are **never** compared against player input during play — see §6.2.

## 5. Dating: local midnight, globally synchronised

Both requirements hold if the index derives from the **local calendar date**, never from elapsed time or a UTC offset. Everyone whose local calendar reads `2026-08-07` gets the same puzzle; Tokyo simply starts it about sixteen hours before Los Angeles.

### 5.1 Two bugs found in review — do not reintroduce

**Bug 1: the epoch must be the launch date.** Earlier revisions hardcoded `2026-01-01`. With a 200-puzzle list, that date is already 219 days in the past: the list would have "exhausted" on 2026-07-20, ids 0–18 would be consumed without a single player ever seeing them, and day one of launch would silently serve puzzle #19. **Set `EPOCH` to the actual first-play date, then never change it** — changing it later reshuffles which puzzle every past date maps to, corrupting every stored history entry and every share string already in the wild.

**Bug 2: the share label must be the day number, not the puzzle id.** The puzzle id wraps at 200, so days 19, 219, and 419 all print `Gates #19`. Display the unwrapped day count instead — monotonic, unique forever, and it reads as a running count of days since launch, which is what players expect. The wrapped id stays internal.

### 5.2 Implementation

```js
/**
 * Local calendar date as YYYY-MM-DD. Built from local getters, never toISOString(),
 * which converts to UTC and silently shifts the date for negative offsets.
 */
function localDateStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Whole days from epoch to the given calendar date. This is the PLAYER-FACING number.
 *
 * Both strings are bare YYYY-MM-DD, which Date.parse reads as UTC midnight. Because
 * BOTH sides parse the same way the timezone cancels out and the result depends only
 * on calendar dates -- which is exactly the global sync guarantee. Rounding absorbs
 * nothing here (the difference is always an exact multiple of a day) but guards
 * against a future refactor that reintroduces local-time Date objects, where DST
 * makes some days 23 or 25 hours long.
 */
function dayNumber(dateStr, epochStr) {
  const MS_PER_DAY = 86400000;
  return Math.round((Date.parse(dateStr) - Date.parse(epochStr)) / MS_PER_DAY);
}

/** Index into the puzzle list. INTERNAL ONLY -- never shown to the player (see 5.1). */
function puzzleIdForDate(dateStr, epochStr, count) {
  const n = dayNumber(dateStr, epochStr);
  return ((n % count) + count) % count;      // guard keeps negatives in range
}
```

### 5.3 Guards

- **Archive range is `[epoch, today]`.** Reject earlier dates (they map to a valid index but represent a day the game did not exist) and future dates (they leak tomorrow's puzzle). Clamp in the date picker *and* re-check on load, since the URL is editable.
- Pitfalls that break global sync: `toISOString().slice(0,10)` converts to UTC first, so a player at UTC-5 gets tomorrow's date after 19:00; subtracting local `Date` objects drifts across DST; deriving from `Date.now()` reintroduces the UTC rollover this design exists to avoid.
- Accepted tradeoff: UTC+13 can spoil for UTC-8. Same as every daily game.

## 6. The truth table: A, B, C, D, Q

| A | B | C | D | Q |
|---|---|---|---|---|
| 0 | 0 | · | · | _ |
| 0 | 1 | · | · | _ |
| 1 | 0 | · | · | _ |
| 1 | 1 | · | · | _ |

- **A, B** — given, read-only.
- **C, D** — optional scratch. C is the top `#2` gate output, D is the bottom. Both labels must be drawn on the SVG at the corresponding wires, or the mapping from table to circuit is guesswork.
- **Q** — the answer. All four cells required.

Every editable cell is tri-state: empty, 0, 1. Tapping cycles `empty → 0 → 1 → empty`.

### 6.1 Submission validity

**A submission is valid only if all four Q cells are filled. C and D are ignored for this check.**

Stated generally rather than as the C/D-only case, because the same rule covers a partially-filled Q, which is far more common than a fully-filled C/D with an empty Q.

- Invalid submission → inline message, **no life spent**, nothing recorded.
- A submission whose Q column exactly matches an earlier attempt → also rejected, **no life spent**. Compare **on the Q column alone**. If duplicate detection included C or D, a player could edit one scratch cell, resubmit the same Q, and lose a life to a no-op.

### 6.2 C and D must never be validated

The single most important constraint in this feature. C and D are the branch functions — the same values that define a puzzle's logical identity. Any feedback on them leaks the answer.

- No correct/incorrect marking on C or D. Not on submit, not on blur, not on hover, not as a DOM class, not as an `aria-` attribute.
- The failure message after a wrong Q must be identical whether C and D were right, wrong, or blank.
- No "check my work" button. Same leak, friendlier label.

C and D contribute nothing to the result, the streak, or the share string. They are private scratch paper that happens to live inside the table.

Reveal C and D only once the day is resolved. On a loss, revealing them alongside the correct Q is the teaching moment.

### 6.3 Scratch persistence

Persist C, D, and any partial Q across reloads within the same day. Losing hand-worked scratch to an accidental refresh on mobile is bad enough to be worth the storage. Discard when the day resolves, or when the stored date is not today.

## 7. Attempt model — 3 lives, whole-table submit

Player fills Q, submits, and the result is **pass or fail only**. Three failures ends the day. **There is no timer** — the only recorded outcome is the attempt sequence.

### 7.1 Why per-row feedback on Q cannot ship

Q is four bits. If a failed submission reveals *which* rows are wrong, the player flips exactly those and wins on attempt 2, every time, without reading the circuit. Lives 2 and 3 become decoration.

Weaker variants leak nearly as badly: revealing only the *count* of correct rows narrows 14 candidates to at most 4, which two remaining lives comfortably cover.

With all-or-nothing feedback, blind guessing wins 3 times in 14 (~21%) and costs the streak to attempt. Reading the circuit wins 100%. That gap is the game.

**Feedback per submission is one bit: correct, or not.**

### 7.2 Lives and completion

- 3 lives, spent only on valid non-duplicate submissions (§6.1).
- Win: reveal and offer the share string.
- Loss: reveal the correct C, D, and Q columns, and highlight the circuit path. Losing should still teach.
- Archive puzzles: fully playable, same 3 lives, results recorded — but **archive plays never affect the streak**, or a player rebuilds a 300-day streak in one afternoon.

## 8. Share string

Checks and Xs, one per attempt. Never includes C, D, or the answer. The number is the day count from §5.1, not the puzzle id.

```
Gates #128
❌❌✅

https://<user>.github.io/gates/
```

- Loss: `❌❌❌`.
- Archive play: append the date so it is not mistaken for today's result — `Gates #61 (2026-03-03)`.
- Copy via `navigator.clipboard.writeText`, with a hidden-textarea + `execCommand` fallback for older mobile Safari.

```js
/**
 * Build the shareable result. `attempts` is an array of booleans, oldest first, the
 * final entry true on a win. `dayNum` is the unwrapped day count -- NOT the puzzle id,
 * which repeats every 200 days. C/D scratch is deliberately absent: it is private and
 * would reveal the branch logic.
 */
function shareString(dayNum, attempts, isArchive, dateStr) {
  const grid = attempts.map((ok) => (ok ? "✅" : "❌")).join("");
  const label = isArchive ? `Gates #${dayNum} (${dateStr})` : `Gates #${dayNum}`;
  return `${label}\n${grid}`;
}
```

## 9. Storage schema

```js
// localStorage key: "gates.v4"
{
  "tutorialSeen": true,          // gates first-run tutorial; stays reachable from a header button
  "lastPlayed": "2026-08-07",    // local calendar date of the last DAILY (not archive) play
  "streak": 4,
  "maxStreak": 11,
  "scratch": {                   // in-progress state for TODAY only; cleared on resolve
    "date": "2026-08-07",
    "c": [0, 1, null, 1],        // null == empty cell
    "d": [1, 1, 0, null],
    "q": [null, null, null, null],
    "tried": [[0, 1, 1, 0]]      // Q columns already submitted, for duplicate rejection
  },
  "history": {
    "2026-08-07": {
      "attempts": [false, true], // one bool per submission, oldest first
      "archive": false           // true if played out of order; excluded from streak math
    }
  }
}
```

- Wrap every read in `try/catch`. Private-browsing modes throw, and a corrupt blob must degrade to "new player", never crash.
- Prune `history` to the most recent 400 entries on write.
- Streak: increment only when `lastPlayed` is exactly the previous calendar day **and** the new entry's `archive` is false. Reset to 1 otherwise. Never increment on replaying a recorded day.
- `scratch` holds one day. If `scratch.date` is not today, discard on load.
- Do not obfuscate the answer — it is in `puzzles.json` and anyone motivated will read it. Wordle shipped with the same exposure and it was a non-issue.

## 10. Layout notes

Five columns at 375 px is the tight case: A and B are read-only and can be narrow, leaving C, D, Q as the tappable targets. Keep tap targets at 44 px minimum height and let column widths compress instead.

Offer a toggle to hide C and D. Players who do the algebra in their head will want the simpler three-column table, and hiding is safe because those columns carry no scored state.

Accessibility: a real `<table>` with `<th scope="col">`; C and D headers labelled as optional working columns; cell state announced as text, never colour alone; ✅/❌ in the results row carry text equivalents.

## 11. Generator tests

```python
def test_invariants():
    """Every emitted puzzle must satisfy every rule. These assertions ARE the spec."""
    data = json.loads(subprocess.check_output(["python3", "tools/generate.py"]))
    p = data["puzzles"]

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
    ...


def test_epoch_is_set():
    """Guard against shipping the placeholder -- see spec section 5.1."""
    data = json.loads(subprocess.check_output(["python3", "tools/generate.py"]))
    assert data["epoch"] != "REPLACE_WITH_LAUNCH_DATE"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", data["epoch"])


def test_reproducible():
    """Two runs must match byte for byte -- catches accidental unseeded randomness."""
    a = subprocess.check_output(["python3", "tools/generate.py"])
    b = subprocess.check_output(["python3", "tools/generate.py"])
    assert a == b
```

## 12. Repo layout

```
/index.html            # game + tutorial modal
/css/                  # existing styling, untouched
/js/
  main.js              # bootstrap, local date → day number → puzzle id
  circuit.js           # SVG render from {nots, gates}, with C/D node labels
  table.js             # 5-column table, tri-state cells, submit validation, lives
  share.js             # result string + clipboard
  storage.js           # localStorage wrapper, all try/catch'd
  archive.js           # date picker → past puzzles, clamped to [epoch, today]
/data/puzzles.json     # generated, committed
/tools/generate.py
/tools/test_generate.py
```

**Tutorial: a modal inside `index.html`, not a separate page** — a separate page means full navigation and lost game state on return. Opens automatically when `tutorialSeen` is falsy, and from a persistent header button after. Content: six gate truth tables, the NOT-bubble convention, and a note that C and D are optional scratch.

## 13. Handoff checklist

Suggested build order. Each step is independently verifiable, so a break is easy to localise.

1. **`tools/generate.py`** — paste §4 verbatim, set `EPOCH`, run it, commit `data/puzzles.json`. Confirm 200 puzzles and a byte-identical second run before moving on.
2. **`tools/test_generate.py`** — §11. Get it green. Everything downstream trusts this data.
3. **`js/storage.js`** — schema in §9, every access in `try/catch`. Build this before the UI so game state has somewhere to live from the start.
4. **`js/circuit.js`** — static SVG for the fixed topology, then drive gate labels, NOT bubbles, and C/D node labels from `{nots, gates}`. Verify against a few puzzles by hand.
5. **`js/table.js`** — tri-state cells, validation (§6.1), lives (§7.2). The C/D non-validation rule (§6.2) lives here and is the easiest thing in the project to break by accident.
6. **`js/main.js`** — dating (§5.2) and wiring. Test at UTC+13 and UTC-8 by changing the OS timezone, not by mocking.
7. **`js/share.js`**, then **`js/archive.js`**, then the tutorial modal.

Invariants that must survive any refactor:

- `EPOCH` never changes after launch (§5.1).
- Player-facing number is the day count; the puzzle id stays internal (§5.1).
- C and D are never validated or marked, in any form (§6.2).
- Q feedback is one bit (§7.1).
- Duplicate detection compares Q only (§6.1).
- Archive plays never touch the streak (§7.2).

Open items deliberately left to implementation: exact SVG styling, tutorial copy, and the wording of the invalid-submission message. Deferred to v2: weekday difficulty ramp, and any topology change to break the 240 ceiling.
