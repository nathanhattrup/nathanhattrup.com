// Gates — daily logic-gate puzzle (gates.html).
// Spec: gates-backend-spec.md. Data: assets/gates-data.js (const GATES_DATA).
//
// Invariants that must survive any refactor (spec §13):
//   - EPOCH never changes after launch.
//   - Player-facing number is the day count; the puzzle id stays internal.
//   - C and D are never validated or marked, in any form.
//   - Q feedback is one bit: correct, or not.
//   - Duplicate detection compares Q only.
//   - Archive plays never touch the streak.

(function () {
  'use strict';

  // gates-data.js declares GATES_DATA with top-level const, which lives in the
  // global lexical scope but NOT on window — so reference the identifier, not
  // a window property.
  var DATA = (typeof GATES_DATA === 'undefined') ? null : GATES_DATA;
  if (!DATA) return;

  var STORE_KEY = 'gates.v4';
  var SITE_URL = 'https://www.nathanhattrup.com/gates';
  var MAX_LIVES = 3;
  var HISTORY_LIMIT = 400;

  /* ============================================================
     Player-facing text — edit freely.
     {curly} placeholders are filled in by the code; keep each one
     wherever you want that value to land in the sentence.
     (Tutorial/how-to-play text lives as plain HTML in gates.html.)
     ============================================================ */
  var STRINGS = {
    header: 'No. {n}',                          // daily title line
    headerArchiveSuffix: ' · archive',          // appended when replaying a past day
    archiveBanner: 'Play past circuits.',
    livesLabel: 'Lives',
    incomplete: 'Fill in Q to submit, C and D are optional',
    duplicate: 'You already tried that..',
    wrong: 'Wrong.. {lives} left.',             // {lives} becomes "2 lives" / "1 life"
    win: 'Correct! Solved in {tries}.',         // {tries} becomes "1 try" / "2 tries"
    loss: 'Out of lives. The correct truth table is shown. Try and figure out why!',
    resolvedWin: 'Solved {icons}, come back tomorrow!',
    resolvedLoss: 'Missed {icons}, come back tomorrow!',
    welcomeBack: 'Welcome back! {lives} left.',
    streakLine: 'Streak {n} · best {m}',
    copied: 'Copied ✓',
    copyFailed: 'Copy failed'
  };

  function fmt(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; });
  }
  function plural(n, word, words) {
    return n + ' ' + (n === 1 ? word : words);
  }

  /* ============================================================
     Dating (spec §5.2) — local calendar date, globally synchronised
     ============================================================ */

  // Local calendar date as YYYY-MM-DD. Built from local getters, never
  // toISOString(), which converts to UTC and silently shifts the date
  // for negative offsets.
  function localDateStr(d) {
    d = d || new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Whole days from epoch to the given calendar date. This is the
  // PLAYER-FACING number. Both strings are bare YYYY-MM-DD, which
  // Date.parse reads as UTC midnight; both sides parsing the same way
  // cancels the timezone out, so the result depends only on calendar
  // dates. Rounding guards against a refactor reintroducing local-time
  // Date objects, where DST makes some days 23 or 25 hours long.
  function dayNumber(dateStr, epochStr) {
    var MS_PER_DAY = 86400000;
    return Math.round((Date.parse(dateStr) - Date.parse(epochStr)) / MS_PER_DAY);
  }

  // Index into the puzzle list. INTERNAL ONLY — never shown to the player.
  function puzzleIdForDate(dateStr, epochStr, count) {
    var n = dayNumber(dateStr, epochStr);
    return ((n % count) + count) % count; // guard keeps negatives in range
  }

  /* ============================================================
     Storage (spec §9) — every access wrapped, corrupt data degrades
     to "new player", never crashes
     ============================================================ */

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var s = raw ? JSON.parse(raw) : {};
      if (typeof s !== 'object' || s === null || Array.isArray(s)) s = {};
      if (typeof s.history !== 'object' || s.history === null) s.history = {};
      return s;
    } catch (e) {
      return { history: {} };
    }
  }

  function saveStore(s) {
    try {
      // Prune history to the most recent entries on write
      var dates = Object.keys(s.history).sort();
      if (dates.length > HISTORY_LIMIT) {
        dates.slice(0, dates.length - HISTORY_LIMIT).forEach(function (d) {
          delete s.history[d];
        });
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (e) { /* private browsing etc. — play on without persistence */ }
  }

  /* ============================================================
     Share string (spec §8)
     ============================================================ */

  // `attempts` is an array of booleans, oldest first, the final entry true
  // on a win. `dayNum` is the unwrapped day count — NOT the puzzle id,
  // which repeats every 200 days. C/D scratch is deliberately absent.
  function shareString(dayNum, attempts, isArchive, dateStr) {
    var grid = attempts.map(function (ok) { return ok ? '✅' : '❌'; }).join('');
    var label = isArchive ? 'Gates #' + dayNum + ' (' + dateStr + ')' : 'Gates #' + dayNum;
    return label + '\n' + grid;
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); },
        function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  // Hidden-textarea + execCommand fallback for older mobile Safari
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  /* ============================================================
     Circuit SVG (spec §12 circuit.js) — fixed topology; only gate
     labels, NOT bubbles, and the C/D node labels vary per puzzle.
     Strokes/fills use currentColor so dark mode is automatic.
     ============================================================ */

  // Distinctive-shape (ANSI/IEEE) gate symbols, drawn in local coords: the
  // input edge sits at x=0, the body is 44 tall (inputs enter at y=8 and
  // y=36, output leaves at y=22). N-variants add the small inversion bubble
  // at the tip. `tip` is where the output wire starts; `inset` is how far
  // input wires run past x=0 so they meet the concave OR/XOR back edge.
  var GATE_SHAPES = {
    AND:  { paths: ['M0,0 H24 A22,22 0 0 1 24,44 H0 Z'], tip: 46, inset: 0 },
    OR:   { paths: ['M0,0 Q30,4 46,22 Q30,40 0,44 Q14,22 0,0 Z'], tip: 46, inset: 5 },
    XOR:  { paths: ['M8,0 Q38,4 54,22 Q38,40 8,44 Q22,22 8,0 Z', 'M0,0 Q14,22 0,44'], tip: 54, inset: 5 }
  };
  var GATE_BASE = { AND: 'AND', NAND: 'AND', OR: 'OR', NOR: 'OR', XOR: 'XOR', XNOR: 'XOR' };

  // Markup for one gate placed with its input edge at (x, cy-22)..(x, cy+22).
  // Returns { svg, outX (abs), inX (abs, where input wires should end) }.
  function gateMarkup(type, x, cy) {
    var base = GATE_SHAPES[GATE_BASE[type]];
    var inverted = type === 'NAND' || type === 'NOR' || type === 'XNOR';
    var s = '<g transform="translate(' + x + ',' + (cy - 22) + ')">';
    base.paths.forEach(function (d) { s += '<path d="' + d + '"/>'; });
    if (inverted) s += '<circle class="not" cx="' + (base.tip + 5.5) + '" cy="22" r="5.5"/>';
    s += '</g>';
    return {
      svg: s,
      outX: x + base.tip + (inverted ? 11 : 0),
      inX: x + base.inset
    };
  }

  function circuitSVG(p) {
    var g1 = p.gates[0], g2 = p.gates[1], g4 = p.gates[2];
    var W = 380, H = 224;
    // Input wire rows: [A→top, B→top, A→bottom, B→bottom]
    var inY = [48, 76, 148, 176];
    var wire = function (x1, y1, x2, y2) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    };
    var top = gateMarkup(g1, 104, 62);
    var bottom = gateMarkup(g2, 104, 162);
    var final_ = gateMarkup(g4, 250, 112);
    var s = '';
    // Input labels + wires (labels repeat for each branch, like the schematic)
    for (var i = 0; i < 4; i++) {
      var name = (i % 2 === 0) ? 'A' : 'B';
      var slot = (i < 2) ? top : bottom;
      s += '<text class="inlabel" x="26" y="' + inY[i] + '" dy="0.35em" text-anchor="end">' + name + '</text>';
      s += wire(34, inY[i], slot.inX, inY[i]);
      if (p.nots[i]) {
        s += '<circle class="not" cx="95" cy="' + inY[i] + '" r="5.5"/>';
      }
    }
    // #2 gate symbols
    s += top.svg + bottom.svg;
    // Branch outputs → final gate, with C/D node labels on the wires.
    // The vertical drop at x=208 clears every symbol tip (max outX is 169).
    s += '<path d="M' + top.outX + ',62 H208 V98 H' + (250 + (GATE_BASE[g4] === 'AND' ? 0 : 5)) + '"/>';
    s += '<path d="M' + bottom.outX + ',162 H208 V126 H' + (250 + (GATE_BASE[g4] === 'AND' ? 0 : 5)) + '"/>';
    s += '<text class="nodelabel" x="188" y="52" text-anchor="middle">C</text>';
    s += '<text class="nodelabel" x="188" y="182" text-anchor="middle">D</text>';
    // #4 final gate symbol
    s += final_.svg;
    // Output
    s += wire(final_.outX, 112, 344, 112);
    s += '<text class="nodelabel" x="352" y="112" dy="0.35em">Q</text>';

    var slotNames = ['A into the top gate', 'B into the top gate',
                     'A into the bottom gate', 'B into the bottom gate'];
    var notted = [];
    for (var j = 0; j < 4; j++) if (p.nots[j]) notted.push(slotNames[j]);
    var desc = 'Inputs A and B each feed two gates. Top gate ' + g1 +
      ' outputs C, bottom gate ' + g2 + ' outputs D. C and D feed a final ' + g4 +
      ' gate whose output is Q.' +
      (notted.length ? ' Inverted inputs (NOT bubbles): ' + notted.join(', ') + '.' : ' No inputs are inverted.');

    return '<svg class="gates-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + desc + '">' +
      '<g class="gates-draw">' + s + '</g></svg>';
  }

  /* ============================================================
     Game state + DOM
     ============================================================ */

  var els = {};
  ['day', 'banner', 'circuit', 'table', 'tbody', 'lives', 'msg', 'submit',
   'share', 'streak', 'archive', 'archiveCal', 'backToday',
   'help', 'modal', 'modalClose', 'app'].forEach(function (id) {
    els[id] = document.getElementById('gates-' + id.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }));
  });

  var store = loadStore();
  var todayStr = localDateStr();
  var epoch = DATA.epoch;

  // mode: 'daily' | 'archive'
  var game = null; // { mode, dateStr, dayNum, puzzle, c, d, q, tried, attempts, resolved, won }

  function newGame(mode, dateStr) {
    var id = puzzleIdForDate(dateStr, epoch, DATA.count);
    return {
      mode: mode,
      dateStr: dateStr,
      dayNum: dayNumber(dateStr, epoch),
      puzzle: DATA.puzzles[id],
      c: [null, null, null, null],
      d: [null, null, null, null],
      q: [null, null, null, null],
      tried: [],      // Q columns already submitted, for duplicate rejection
      attempts: [],   // one bool per valid submission, oldest first
      resolved: false,
      won: false
    };
  }

  /* ---------- scratch persistence (spec §6.3): today's daily only ---------- */

  function saveScratch() {
    if (game.mode !== 'daily' || game.resolved) return;
    store.scratch = {
      date: game.dateStr,
      c: game.c.slice(), d: game.d.slice(), q: game.q.slice(),
      tried: game.tried.map(function (t) { return t.slice(); })
    };
    saveStore(store);
  }

  function restoreScratch() {
    var sc = store.scratch;
    if (!sc || sc.date !== game.dateStr) {
      if (sc) { delete store.scratch; saveStore(store); } // stale: not today
      return;
    }
    var cell = function (v) { return (v === 0 || v === 1) ? v : null; };
    ['c', 'd', 'q'].forEach(function (k) {
      if (Array.isArray(sc[k]) && sc[k].length === 4) game[k] = sc[k].map(cell);
    });
    if (Array.isArray(sc.tried)) {
      game.tried = sc.tried.filter(function (t) {
        return Array.isArray(t) && t.length === 4;
      }).slice(0, MAX_LIVES);
      // A stored tried entry is by definition a spent (wrong) attempt
      game.attempts = game.tried.map(function () { return false; });
    }
  }

  /* ---------- rendering ---------- */

  function rowLabel(r) {
    return 'A ' + DATA.rows[r][0] + ', B ' + DATA.rows[r][1];
  }

  function renderTable() {
    var html = '';
    for (var r = 0; r < 4; r++) {
      html += '<tr><td>' + DATA.rows[r][0] + '</td><td>' + DATA.rows[r][1] + '</td>';
      ['c', 'd', 'q'].forEach(function (col) {
        html += '<td><button type="button" class="gates-cell" data-col="' + col +
          '" data-row="' + r + '"></button></td>';
      });
      html += '</tr>';
    }
    els.tbody.innerHTML = html;
    els.tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('.gates-cell');
      if (!btn || game.resolved || btn.disabled) return;
      var col = btn.dataset.col, r = +btn.dataset.row;
      var v = game[col][r];
      // Tap cycles empty → 0 → 1 → empty
      game[col][r] = (v === null) ? 0 : (v === 0) ? 1 : null;
      saveScratch();
      syncCells();
    });
    syncCells();
  }

  function syncCells() {
    els.tbody.querySelectorAll('.gates-cell').forEach(function (btn) {
      var col = btn.dataset.col, r = +btn.dataset.row;
      var v = game[col][r];
      btn.textContent = (v === null) ? '·' : String(v);
      btn.classList.toggle('empty', v === null);
      var colName = col.toUpperCase() + (col === 'q' ? '' : ' (scratch)');
      btn.setAttribute('aria-label',
        colName + ' for row ' + rowLabel(r) + ': ' + (v === null ? 'empty' : v));
    });
  }

  // Only wrong submissions spend a life — the winning submission is free.
  function livesSpent() {
    return game.attempts.filter(function (ok) { return !ok; }).length;
  }

  function renderLives() {
    var spent = livesSpent();
    var dots = '';
    for (var i = 0; i < MAX_LIVES; i++) {
      dots += (i < MAX_LIVES - spent) ? '●' : '○';
    }
    els.lives.innerHTML = STRINGS.livesLabel + ' <span class="gates-dots">' + dots + '</span>';
    els.lives.setAttribute('aria-label', STRINGS.livesLabel + ': ' + (MAX_LIVES - spent) + ' of ' + MAX_LIVES + ' remaining');
  }

  function renderHeader() {
    var label = fmt(STRINGS.header, { n: game.dayNum, date: game.dateStr });
    if (game.mode === 'archive') label += STRINGS.headerArchiveSuffix;
    els.day.textContent = label;
  }

  function renderStreak() {
    if (game.mode !== 'daily') { els.streak.textContent = ''; return; }
    var s = store.streak || 0, m = store.maxStreak || 0;
    els.streak.textContent = s ? fmt(STRINGS.streakLine, { n: s, m: m }) : '';
  }

  function setMsg(text, tone) {
    els.msg.textContent = text || '';
    els.msg.className = 'gates-msg' + (tone ? ' ' + tone : '');
  }

  /* ---------- resolution ---------- */

  // Reveal C and D only once the day is resolved (spec §6.2). On a loss,
  // revealing them alongside the correct Q is the teaching moment.
  function reveal() {
    var p = game.puzzle;
    els.tbody.querySelectorAll('.gates-cell').forEach(function (btn) {
      var col = btn.dataset.col, r = +btn.dataset.row;
      var correct = p[col][r];
      var had = game[col][r];
      btn.textContent = String(correct);
      btn.classList.remove('empty');
      btn.classList.toggle('corrected', col === 'q' && had !== correct);
      btn.disabled = true;
      btn.setAttribute('aria-label', col.toUpperCase() + ' for row ' + rowLabel(r) + ': ' + correct + ' (revealed)');
    });
    var svg = els.circuit.querySelector('.gates-svg');
    if (svg) svg.classList.add('gates-reveal');
    els.submit.hidden = true;
    els.share.hidden = false;
  }

  function recordResolution() {
    var entry = { attempts: game.attempts.slice(), archive: game.mode === 'archive' };
    store.history[game.dateStr] = entry;
    if (game.mode === 'daily') {
      // Streak: increment only when lastPlayed is exactly the previous
      // calendar day and this entry is not archive. Never on replays.
      var prev = store.lastPlayed;
      var yesterday = prev && dayNumber(game.dateStr, prev) === 1;
      store.streak = yesterday ? (store.streak || 0) + 1 : 1;
      store.maxStreak = Math.max(store.maxStreak || 0, store.streak);
      store.lastPlayed = game.dateStr;
      delete store.scratch; // discard when the day resolves
    }
    saveStore(store);
  }

  function finish(won) {
    game.resolved = true;
    game.won = won;
    recordResolution();
    reveal();
    renderLives();
    renderStreak();
    if (won) {
      setMsg(fmt(STRINGS.win, { tries: plural(game.attempts.length, 'try', 'tries') }), 'good');
    } else {
      setMsg(STRINGS.loss, 'bad');
    }
  }

  /* ---------- submission (spec §6.1, §7) ---------- */

  function submit() {
    if (game.resolved) return;
    // Valid only if all four Q cells are filled. C and D are ignored here.
    if (game.q.some(function (v) { return v === null; })) {
      setMsg(STRINGS.incomplete, '');
      return;
    }
    // Duplicate Q column → rejected, no life spent. Q only, never C/D.
    var dup = game.tried.some(function (t) {
      return t.every(function (v, i) { return v === game.q[i]; });
    });
    if (dup) {
      setMsg(STRINGS.duplicate, '');
      return;
    }
    game.tried.push(game.q.slice());
    var correct = game.q.every(function (v, i) { return v === game.puzzle.q[i]; });
    game.attempts.push(correct);
    if (correct) {
      finish(true);
      return;
    }
    if (game.attempts.length >= MAX_LIVES) {
      finish(false);
      return;
    }
    // One bit of feedback: correct, or not. Identical wording no matter
    // what C and D hold (spec §6.2).
    saveScratch();
    renderLives();
    var left = MAX_LIVES - livesSpent();
    setMsg(fmt(STRINGS.wrong, { lives: plural(left, 'life', 'lives') }), 'bad');
  }

  /* ---------- resolved-day view (revisiting a finished date) ---------- */

  function showResolved(entry) {
    game.resolved = true;
    game.attempts = entry.attempts.slice();
    game.won = entry.attempts[entry.attempts.length - 1] === true;
    reveal();
    renderLives();
    renderStreak();
    var icons = entry.attempts.map(function (ok) { return ok ? '✓' : '✗'; }).join(' ');
    setMsg(fmt(game.won ? STRINGS.resolvedWin : STRINGS.resolvedLoss, { icons: icons }),
      game.won ? 'good' : 'bad');
  }

  /* ---------- share ---------- */

  function doShare() {
    var text = shareString(game.dayNum, game.attempts, game.mode === 'archive', game.dateStr) +
      '\n\n' + SITE_URL;
    copyText(text, function (ok) {
      var old = els.share.textContent;
      els.share.textContent = ok ? STRINGS.copied : STRINGS.copyFailed;
      setTimeout(function () { els.share.textContent = old; }, 1600);
    });
  }

  /* ---------- tutorial modal ---------- */

  function openModal() {
    els.modal.hidden = false;
    els.modalClose.focus();
  }
  function closeModal() {
    els.modal.hidden = true;
    els.help.focus();
    if (!store.tutorialSeen) {
      store.tutorialSeen = true;
      saveStore(store);
    }
  }
  function initModal() {
    els.help.addEventListener('click', openModal);
    els.modalClose.addEventListener('click', closeModal);
    els.modal.addEventListener('click', function (e) {
      if (e.target === els.modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
    if (!store.tutorialSeen) openModal();
    // Draw each gate's schematic symbol next to its truth table, with
    // labelled A/B input stubs and a Q output stub so it reads exactly
    // like a fragment of the daily circuit.
    document.querySelectorAll('.gates-sym').forEach(function (span) {
      var type = span.dataset.gate;
      var g = gateMarkup(type, 24, 24);
      var inEnd = 24 + GATE_SHAPES[GATE_BASE[type]].inset;
      span.innerHTML = '<svg class="gates-symsvg" viewBox="0 0 118 48" aria-hidden="true">' +
        '<text class="symlabel" x="10" y="10" dy="0.35em" text-anchor="end">A</text>' +
        '<text class="symlabel" x="10" y="38" dy="0.35em" text-anchor="end">B</text>' +
        '<line x1="14" y1="10" x2="' + inEnd + '" y2="10"/>' +
        '<line x1="14" y1="38" x2="' + inEnd + '" y2="38"/>' +
        g.svg +
        '<line x1="' + g.outX + '" y1="24" x2="' + (g.outX + 10) + '" y2="24"/>' +
        '<text class="symlabel" x="' + (g.outX + 14) + '" y="24" dy="0.35em">Q</text></svg>';
    });
  }

  /* ---------- archive (spec §12 archive.js) ----------
     One clickable cell per day from the epoch through today, labelled
     with its puzzle number: a plain grid, 10 per row, growing left to
     right, top to bottom. Only [epoch, today] is ever rendered, and
     the ?date= URL is re-checked on load anyway. */

  function initArchive() {
    if (todayStr < epoch) { els.archive.hidden = true; return; }

    // Walk day by day from epoch to today with calendar-safe local Dates
    // (setDate handles month ends and DST).
    var parts = epoch.split('-').map(Number);
    var cur = new Date(parts[0], parts[1] - 1, parts[2]);
    var html = '';
    while (true) {
      var ds = localDateStr(cur);
      if (ds > todayStr) break;
      var entry = store.history[ds];
      var status = '';
      if (entry && Array.isArray(entry.attempts) && entry.attempts.length) {
        status = entry.attempts[entry.attempts.length - 1] ? 'won' : 'lost';
      }
      var isToday = ds === todayStr;
      var cls = 'gates-cal-cell' + (status ? ' ' + status : '') +
        (isToday ? ' today' : '') + (ds === game.dateStr ? ' current' : '');
      var href = isToday ? 'gates.html' : 'gates.html?date=' + ds;
      var state = status === 'won' ? 'solved' : status === 'lost' ? 'missed' : 'not played yet';
      html += '<a class="' + cls + '" href="' + href + '" aria-label="Puzzle No. ' +
        dayNumber(ds, epoch) + ', ' + ds + ', ' + state + '">' + dayNumber(ds, epoch) + '</a>';
      cur.setDate(cur.getDate() + 1);
    }
    els.archiveCal.innerHTML = '<div class="gates-cal-grid">' + html + '</div>';
    els.backToday.hidden = game.mode !== 'archive';
  }

  /* ---------- boot ---------- */

  function startGame(mode, dateStr) {
    game = newGame(mode, dateStr);
    renderHeader();
    els.circuit.innerHTML = circuitSVG(game.puzzle);
    renderTable();

    var entry = store.history[dateStr];
    if (entry && Array.isArray(entry.attempts) && entry.attempts.length) {
      showResolved(entry);
    } else {
      if (mode === 'daily') restoreScratch();
      syncCells();
      renderLives();
      renderStreak();
      if (game.attempts.length) {
        var left = MAX_LIVES - livesSpent();
        setMsg(fmt(STRINGS.welcomeBack, { lives: plural(left, 'life', 'lives') }), '');
      }
    }

    els.submit.hidden = game.resolved;
    els.submit.onclick = submit;
    els.share.onclick = doShare;
  }

  function init() {
    initModal();

    // Clock-skew guard: a device whose local date is somehow before the
    // epoch still gets the first puzzle rather than a negative day number.
    if (todayStr < epoch) todayStr = epoch;

    /* Archive is disabled for now. To restore it, uncomment this block
       (and the archive markup in gates.html), and move the plain
       startGame call below into the else branch.

    var params = new URLSearchParams(location.search);
    var reqDate = params.get('date');

    // Archive range is [epoch, today]. Reject earlier dates and future
    // dates; the URL is editable, so re-check here regardless of the grid.
    if (reqDate && /^\d{4}-\d{2}-\d{2}$/.test(reqDate) &&
        reqDate >= epoch && reqDate <= todayStr && reqDate !== todayStr) {
      startGame('archive', reqDate);
      els.banner.hidden = false;
      els.banner.textContent = STRINGS.archiveBanner;
    } else {
      if (reqDate) history.replaceState(null, '', location.pathname); // invalid param: drop it
      startGame('daily', todayStr);
    }
    initArchive();
    */

    startGame('daily', todayStr);
  }

  init();
})();
