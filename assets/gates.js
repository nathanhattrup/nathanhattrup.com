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
  var SCRATCH_TOGGLE_KEY = 'gates.hideScratch'; // UI pref only, outside the game schema
  var SITE_URL = 'https://www.nathanhattrup.com/gates';
  var MAX_LIVES = 3;
  var HISTORY_LIMIT = 400;

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

  function circuitSVG(p) {
    var g1 = p.gates[0], g2 = p.gates[1], g4 = p.gates[2];
    var W = 380, H = 224;
    // Input wire rows: [A→top, B→top, A→bottom, B→bottom]
    var inY = [48, 76, 148, 176];
    var wire = function (x1, y1, x2, y2) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    };
    var s = '';
    // Input labels + wires (labels repeat for each branch, like the schematic)
    for (var i = 0; i < 4; i++) {
      var name = (i % 2 === 0) ? 'A' : 'B';
      s += '<text class="inlabel" x="26" y="' + inY[i] + '" dy="0.35em" text-anchor="end">' + name + '</text>';
      s += wire(34, inY[i], 104, inY[i]);
      if (p.nots[i]) {
        s += '<circle class="not" cx="95" cy="' + inY[i] + '" r="5.5"/>';
      }
    }
    // #2 gate boxes
    s += '<rect x="104" y="36" width="62" height="52"/>';
    s += '<text class="gatelabel" x="135" y="62" dy="0.35em" text-anchor="middle">' + g1 + '</text>';
    s += '<rect x="104" y="136" width="62" height="52"/>';
    s += '<text class="gatelabel" x="135" y="162" dy="0.35em" text-anchor="middle">' + g2 + '</text>';
    // Branch outputs → final gate, with C/D node labels on the wires
    s += '<path d="M166,62 H208 V98 H250" fill="none"/>';
    s += '<path d="M166,162 H208 V126 H250" fill="none"/>';
    s += '<text class="nodelabel" x="187" y="52" text-anchor="middle">C</text>';
    s += '<text class="nodelabel" x="187" y="182" text-anchor="middle">D</text>';
    // #4 final gate
    s += '<rect x="250" y="86" width="62" height="52"/>';
    s += '<text class="gatelabel" x="281" y="112" dy="0.35em" text-anchor="middle">' + g4 + '</text>';
    // Output
    s += wire(312, 112, 344, 112);
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
   'share', 'streak', 'archive', 'archiveDate', 'backToday', 'scratchToggle',
   'help', 'modal', 'modalClose', 'app'].forEach(function (id) {
    els[id] = document.getElementById('gates-' + id.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }));
  });

  var store = loadStore();
  var todayStr = localDateStr();
  var epoch = DATA.epoch;

  // mode: 'daily' | 'archive' | 'preview' (preview: pre-launch spot-check, nothing saved)
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

  function renderLives() {
    var spent = game.attempts.length;
    var dots = '';
    for (var i = 0; i < MAX_LIVES; i++) {
      dots += (i < MAX_LIVES - spent) ? '●' : '○';
    }
    els.lives.innerHTML = 'Lives <span class="gates-dots">' + dots + '</span>';
    els.lives.setAttribute('aria-label', 'Lives: ' + (MAX_LIVES - spent) + ' of ' + MAX_LIVES + ' remaining');
  }

  function renderHeader() {
    var label = 'No. ' + game.dayNum + ' · ' + game.dateStr;
    if (game.mode === 'archive') label += ' · archive';
    if (game.mode === 'preview') label = 'Preview · No. ' + game.dayNum + ' · ' + game.dateStr;
    els.day.textContent = label;
  }

  function renderStreak() {
    if (game.mode !== 'daily') { els.streak.textContent = ''; return; }
    var s = store.streak || 0, m = store.maxStreak || 0;
    els.streak.textContent = s ? ('Streak ' + s + ' · best ' + m) : '';
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
    if (game.mode !== 'preview') {
      els.share.hidden = false;
    }
  }

  function recordResolution() {
    if (game.mode === 'preview') return; // spot-check mode: nothing recorded
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
      setMsg('Correct! Solved in ' + game.attempts.length + (game.attempts.length === 1 ? ' try.' : ' tries.'), 'good');
    } else {
      setMsg('Out of lives. The correct table is shown — trace C and D through the circuit to see why.', 'bad');
    }
  }

  /* ---------- submission (spec §6.1, §7) ---------- */

  function submit() {
    if (game.resolved) return;
    // Valid only if all four Q cells are filled. C and D are ignored here.
    if (game.q.some(function (v) { return v === null; })) {
      setMsg('Fill in all four Q cells to submit — C and D are optional scratch.', '');
      return;
    }
    // Duplicate Q column → rejected, no life spent. Q only, never C/D.
    var dup = game.tried.some(function (t) {
      return t.every(function (v, i) { return v === game.q[i]; });
    });
    if (dup) {
      setMsg('You already tried that Q column — no life spent.', '');
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
    var left = MAX_LIVES - game.attempts.length;
    setMsg('Not it. ' + left + (left === 1 ? ' life' : ' lives') + ' left.', 'bad');
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
    setMsg((game.won ? 'Solved' : 'Missed') + ' — ' + icons + '. Come back tomorrow for the next one.',
      game.won ? 'good' : 'bad');
  }

  /* ---------- share ---------- */

  function doShare() {
    var text = shareString(game.dayNum, game.attempts, game.mode === 'archive', game.dateStr) +
      '\n\n' + SITE_URL;
    copyText(text, function (ok) {
      var old = els.share.textContent;
      els.share.textContent = ok ? 'Copied ✓' : 'Copy failed';
      setTimeout(function () { els.share.textContent = old; }, 1600);
    });
  }

  /* ---------- scratch column toggle (spec §10) ---------- */

  function initScratchToggle() {
    var hidden = false;
    try { hidden = localStorage.getItem(SCRATCH_TOGGLE_KEY) === '1'; } catch (e) {}
    els.scratchToggle.checked = !hidden;
    els.table.classList.toggle('hide-scratch', hidden);
    els.scratchToggle.addEventListener('change', function () {
      var hide = !els.scratchToggle.checked;
      els.table.classList.toggle('hide-scratch', hide);
      try { localStorage.setItem(SCRATCH_TOGGLE_KEY, hide ? '1' : '0'); } catch (e) {}
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
  }

  /* ---------- archive (spec §12 archive.js) ---------- */

  function initArchive() {
    if (todayStr < epoch) { els.archive.hidden = true; return; }
    els.archiveDate.min = epoch;
    els.archiveDate.max = todayStr;
    els.archiveDate.addEventListener('change', function () {
      var d = els.archiveDate.value;
      if (!d) return;
      // Clamp in the picker AND re-check on load — the URL is editable
      if (d < epoch || d > todayStr) return;
      location.search = '?date=' + d;
    });
    els.backToday.hidden = game.mode !== 'archive';
  }

  /* ---------- boot ---------- */

  function startGame(mode, dateStr) {
    game = newGame(mode, dateStr);
    renderHeader();
    els.circuit.innerHTML = circuitSVG(game.puzzle);
    renderTable();

    var entry = (mode !== 'preview') && store.history[dateStr];
    if (entry && Array.isArray(entry.attempts) && entry.attempts.length) {
      showResolved(entry);
    } else {
      if (mode === 'daily') restoreScratch();
      syncCells();
      renderLives();
      renderStreak();
      if (game.attempts.length) {
        var left = MAX_LIVES - game.attempts.length;
        setMsg('Welcome back — ' + left + (left === 1 ? ' life' : ' lives') + ' left.', '');
      }
    }

    els.submit.hidden = game.resolved;
    els.submit.onclick = submit;
    els.share.onclick = doShare;
  }

  function init() {
    initScratchToggle();
    initModal();

    var params = new URLSearchParams(location.search);
    var reqDate = params.get('date');

    if (todayStr < epoch) {
      // Pre-launch: daily puzzle 0 belongs to the epoch date. Offer an
      // explicit preview that records nothing, for spot-checking.
      els.banner.hidden = false;
      els.banner.innerHTML = 'The first puzzle unlocks on <strong>' + epoch +
        '</strong>. <button type="button" class="gates-btn" id="gates-preview-btn">Preview it now</button>' +
        '<span class="gates-preview-note" hidden> — preview only, nothing is saved.</span>';
      els.app.classList.add('gates-prelaunch');
      document.getElementById('gates-preview-btn').addEventListener('click', function (e) {
        e.target.hidden = true;
        els.banner.querySelector('.gates-preview-note').hidden = false;
        els.app.classList.remove('gates-prelaunch');
        startGame('preview', epoch);
      });
      els.archive.hidden = true;
      els.day.textContent = 'Launches ' + epoch;
      if (params.get('preview')) {
        document.getElementById('gates-preview-btn').click();
      }
      return;
    }

    // Archive range is [epoch, today]. Reject earlier dates and future
    // dates; the URL is editable, so re-check here regardless of the picker.
    if (reqDate && /^\d{4}-\d{2}-\d{2}$/.test(reqDate) &&
        reqDate >= epoch && reqDate <= todayStr && reqDate !== todayStr) {
      startGame('archive', reqDate);
      els.banner.hidden = false;
      els.banner.textContent = 'Archive play — counts in your history, never toward your streak.';
      els.archiveDate.value = reqDate;
    } else {
      if (reqDate) history.replaceState(null, '', location.pathname); // invalid param: drop it
      startGame('daily', todayStr);
    }
    initArchive();
  }

  init();
})();
