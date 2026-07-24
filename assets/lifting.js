// Meet-progress line charts for lifting.html.
//
// Load order (script tags at bottom of lifting.html):
//   d3.v7.min.js     - scales, axes, line generator
//   lifting-data.js  - meet data as `const LIFTING_MEETS = [...]` (kg), generated
//                      from assets/nathanhattrup.csv by make_lifting_data.py
//   lifting.js       - this file
//
// One chart per `.liftchart[data-metric]` div. Colors live in style.css as
// CSS custom properties (--chart-squat etc.) so dark mode swaps them; the
// theme toggle fires a synthetic resize event, which triggers a full redraw.
(function () {

  // ------------------------------------------------------------------
  // Tunables - fiddle with these
  // ------------------------------------------------------------------
  var LBS_PER_KG  = 2.20462;
  var EVENTS = [ // dashed vertical markers; labels drawn only on the chart with data-event-labels
    { date: '2024-11-02', label: 'SI joint injury' }
  ];
  var CHART_HEIGHT = 260;   // plot height in px (px, not counting axis band)
  var DOT_R        = 4.5;   // data point radius
  var X_PAD_DAYS   = 60;    // breathing room before first / after last meet
  var Y_PAD_FRAC   = 0.10;  // y-domain padding above max / below min

  var charts = document.querySelectorAll('.liftchart[data-metric]');
  if (!charts.length || typeof LIFTING_MEETS === 'undefined') return;

  var METRIC_LABELS = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift', total: 'Total', dots: 'DOTS' };

  var meets = LIFTING_MEETS.map(function (m) {
    var d = Object.assign({}, m);
    d.dateObj = new Date(m.date + 'T12:00:00'); // noon dodges TZ day-shift
    return d;
  });

  function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }
  function fmtLbs(kg) { return d3.format(',')(Math.round(kg * LBS_PER_KG)); }
  function fmtKg(kg)  { return d3.format('~f')(kg); }
  var fmtDate = d3.timeFormat('%b %d, %Y');

  // One shared tooltip element, repositioned per chart
  var tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  var tipValue = document.createElement('strong');
  var tipMeet = document.createElement('span');
  var tipDate = document.createElement('span');
  tip.appendChild(tipValue);
  tip.appendChild(tipMeet);
  tip.appendChild(tipDate);
  document.body.appendChild(tip);

  function drawChart(container) {
    var metric = container.dataset.metric;
    var isDots = metric === 'dots';
    var showEventLabels = 'eventLabels' in container.dataset;
    var color = cssVar('--chart-' + metric) || '#2a78d6';
    var surface = cssVar('--body-bg-color') || '#fff';

    container.innerHTML = '';

    var width = container.clientWidth;
    if (!width) return;

    // Same right margin with or without a kg axis, so all five plots align
    var margin = { top: showEventLabels ? 34 : 22, right: 54, bottom: 34, left: 54 };
    var innerW = width - margin.left - margin.right;
    var innerH = CHART_HEIGHT - margin.top - margin.bottom;

    // Values plotted in lbs (kg metrics) so the left axis reads clean lbs numbers
    var val = isDots
      ? function (m) { return m[metric]; }
      : function (m) { return m[metric] * LBS_PER_KG; };
    var pts = meets.filter(function (m) { return m[metric] != null; });

    var x = d3.scaleTime()
      .domain([
        d3.timeDay.offset(pts[0].dateObj, -X_PAD_DAYS),
        d3.timeDay.offset(pts[pts.length - 1].dateObj, X_PAD_DAYS)
      ])
      .range([0, innerW]);

    var ext = d3.extent(pts, val);
    var pad = (ext[1] - ext[0]) * Y_PAD_FRAC || 10;
    var y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).nice(5).range([innerH, 0]);

    var svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', CHART_HEIGHT)
      .attr('tabindex', 0)
      .attr('role', 'img')
      .attr('aria-label', METRIC_LABELS[metric] + ' over time; values also in the meet results table below');

    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Gridlines: hairline, recessive, from left-axis ticks
    g.append('g').attr('class', 'chart-grid')
      .selectAll('line').data(y.ticks(5)).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', y).attr('y2', y);

    // Axes: no domain path, no tick marks - just numbers + gridlines
    var axL = g.append('g').attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(9)
        .tickFormat(isDots ? d3.format('~f') : d3.format(',')));
    var axB = g.append('g').attr('class', 'chart-axis')
      .attr('transform', 'translate(0,' + innerH + ')')
      .call(d3.axisBottom(x).ticks(Math.max(3, Math.min(6, Math.round(innerW / 120))))
        .tickSize(0).tickPadding(10).tickFormat(d3.timeFormat(innerW < 420 ? '%b ’%y' : '%b %Y')));
    axL.select('.domain').remove();
    axB.select('.domain').remove();
    g.append('line').attr('class', 'chart-grid')
      .attr('x1', 0).attr('x2', innerW).attr('y1', innerH).attr('y2', innerH);

    if (!isDots) {
      // Right axis: same scale relabeled in kg (exact conversion, not a second scale)
      var yKg = d3.scaleLinear()
        .domain([y.domain()[0] / LBS_PER_KG, y.domain()[1] / LBS_PER_KG])
        .range(y.range());
      var axR = g.append('g').attr('class', 'chart-axis')
        .attr('transform', 'translate(' + innerW + ',0)')
        .call(d3.axisRight(yKg).ticks(5).tickSize(0).tickPadding(9).tickFormat(d3.format('~f')));
      axR.select('.domain').remove();
      g.append('text').attr('class', 'chart-axis-title')
        .attr('x', innerW + 44).attr('y', -10).attr('text-anchor', 'end').text('kg');
    }
    g.append('text').attr('class', 'chart-axis-title')
      .attr('x', -44).attr('y', -10).text(isDots ? 'DOTS' : 'lbs');

    // Event markers: dashed vertical annotation lines
    EVENTS.forEach(function (ev) {
      var d = new Date(ev.date + 'T12:00:00');
      if (d < x.domain()[0] || d > x.domain()[1]) return;
      var ex = x(d);
      g.append('line').attr('class', 'chart-event')
        .attr('x1', ex).attr('x2', ex).attr('y1', showEventLabels ? -14 : -4).attr('y2', innerH);
      if (showEventLabels) {
        var onRight = ex > innerW / 2;
        g.append('text').attr('class', 'chart-event-label')
          .attr('x', ex + (onRight ? -6 : 6)).attr('y', -18)
          .attr('text-anchor', onRight ? 'end' : 'start')
          .text(ev.label);
      }
    });

    // The line + points
    g.append('path').attr('class', 'chart-line')
      .attr('d', d3.line()
        .x(function (m) { return x(m.dateObj); })
        .y(function (m) { return y(val(m)); })(pts))
      .attr('stroke', color);

    var dots = g.append('g').selectAll('circle').data(pts).join('circle')
      .attr('cx', function (m) { return x(m.dateObj); })
      .attr('cy', function (m) { return y(val(m)); })
      .attr('r', DOT_R)
      .attr('fill', color)
      .attr('stroke', surface)
      .attr('stroke-width', 2);

    // Direct label on the endpoint only; axis + tooltip + table carry the rest
    var last = pts[pts.length - 1];
    var endLabel = g.append('text').attr('class', 'chart-end-label')
      .attr('y', y(val(last)) - 12)
      .attr('text-anchor', 'middle')
      .text(isDots ? d3.format('.1f')(last[metric]) : fmtLbs(last[metric]) + ' lbs');
    // Center over the dot, then nudge fully clear of any event line it touches
    (function () {
      var w = endLabel.node().getComputedTextLength();
      var lx = x(last.dateObj);
      EVENTS.forEach(function (ev) {
        var d = new Date(ev.date + 'T12:00:00');
        if (d < x.domain()[0] || d > x.domain()[1]) return;
        var ex = x(d);
        if (lx - w / 2 < ex + 4 && lx + w / 2 > ex - 4) {
          // shift right of the line, or left of it if that would crowd the right axis
          lx = (ex + 6 + w <= innerW + 4) ? ex + 6 + w / 2 : ex - 6 - w / 2;
        }
      });
      endLabel.attr('x', Math.max(w / 2, lx));
    })();

    // ----- hover: crosshair snaps to nearest meet, tooltip shows the numbers -----
    var crosshair = g.append('line').attr('class', 'chart-crosshair')
      .attr('y1', 0).attr('y2', innerH).style('display', 'none');

    var activeIdx = -1;
    function setActive(i) {
      activeIdx = i;
      if (i < 0) {
        crosshair.style('display', 'none');
        dots.attr('r', DOT_R);
        tip.hidden = true;
        return;
      }
      var m = pts[i];
      var px = x(m.dateObj), py = y(val(m));
      crosshair.style('display', null).attr('x1', px).attr('x2', px);
      dots.attr('r', function (d, j) { return j === i ? DOT_R + 1.5 : DOT_R; });

      tipValue.textContent = isDots
        ? d3.format('.2f')(m[metric])
        : fmtLbs(m[metric]) + ' lbs / ' + fmtKg(m[metric]) + ' kg';
      tipMeet.textContent = m.meet;
      tipDate.textContent = fmtDate(m.dateObj);
      tip.style.borderLeftColor = color;
      tip.hidden = false;

      var rect = container.getBoundingClientRect();
      var pageX = rect.left + window.scrollX + margin.left + px;
      var pageY = rect.top + window.scrollY + margin.top + py;
      var tw = tip.offsetWidth;
      var flip = margin.left + px + 14 + tw > width; // keep tooltip inside the page
      tip.style.left = (flip ? pageX - tw - 14 : pageX + 14) + 'px';
      tip.style.top = (pageY - tip.offsetHeight / 2) + 'px';
    }

    function nearest(evt) {
      var mx = d3.pointer(evt, g.node())[0];
      var best = 0, bestDist = Infinity;
      pts.forEach(function (m, i) {
        var dd = Math.abs(x(m.dateObj) - mx);
        if (dd < bestDist) { bestDist = dd; best = i; }
      });
      return best;
    }

    svg.append('rect') // hit layer: the whole plot, never just the 2px line
      .attr('x', margin.left).attr('y', margin.top)
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .on('pointermove', function (evt) { setActive(nearest(evt)); })
      .on('pointerleave', function () { setActive(-1); });

    // Keyboard: same readout as hover (arrow keys step through meets)
    svg.on('focus', function () { setActive(pts.length - 1); })
      .on('blur', function () { setActive(-1); })
      .on('keydown', function (evt) {
        if (evt.key === 'ArrowLeft') { setActive(Math.max(0, activeIdx - 1)); evt.preventDefault(); }
        if (evt.key === 'ArrowRight') { setActive(Math.min(pts.length - 1, activeIdx + 1)); evt.preventDefault(); }
        if (evt.key === 'Escape') setActive(-1);
      });
  }

  function drawAll() {
    tip.hidden = true;
    charts.forEach(drawChart);
  }

  // Table view: every charted value, readable without hovering anything
  function buildTable() {
    var tbody = document.getElementById('meet-results-body');
    if (!tbody) return;
    meets.slice().reverse().forEach(function (m) { // most recent meet first
      var tr = document.createElement('tr');
      function td(txt, isHead) {
        var cell = document.createElement(isHead ? 'th' : 'td');
        cell.textContent = txt;
        tr.appendChild(cell);
      }
      // One cell per lift: all attempts in order, best made attempt bold,
      // misses negative + struck through (OpenPowerlifting convention)
      function tdAttempts(atts, best) {
        var cell = document.createElement('td');
        atts.forEach(function (a, i) {
          if (i) cell.appendChild(document.createTextNode('/'));
          var span = document.createElement(a === best ? 'b' : 'span');
          if (a < 0) span.className = 'att-miss';
          span.textContent = fmtKg(Math.abs(a)); // strikethrough alone marks the miss
          cell.appendChild(span);
        });
        if (!atts.length) cell.textContent = '—';
        tr.appendChild(cell);
      }
      td(m.meet + ' ' + d3.timeFormat('%m/%d/%y')(m.dateObj), true);
      td(m.bodyweight != null ? fmtKg(m.bodyweight) : '—');
      tdAttempts(m.squatAttempts, m.squat);
      tdAttempts(m.benchAttempts, m.bench);
      tdAttempts(m.deadliftAttempts, m.deadlift);
      td(m.total != null ? fmtKg(m.total) : '—');
      td(m.dots != null ? d3.format('.1f')(m.dots) : '—');
      tbody.appendChild(tr);
    });
  }

  buildTable();
  drawAll();

  // Redraw on resize; the dark mode toggle fires a synthetic resize too,
  // so charts re-read their CSS-variable colors on theme change
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawAll, 120);
  });

})();
