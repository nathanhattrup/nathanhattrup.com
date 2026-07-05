// Spinning lineart globe with red pins for visited places (index.html, Travel section).
//
// Load order matters (see script tags at bottom of index.html):
//   d3.v7.min.js          - projection math, drag behavior, path rendering
//   topojson-client.min.js - decodes the compact TopoJSON land data
//   land-110m.js          - world coastlines as `const WORLD_LAND = {...}`
//   countries-110m.js     - country polygons as `const WORLD_COUNTRIES = {...}`
//   us-states-110m.js     - US state lines as `const US_STATE_LINES = {...}`
//   locations.js          - pin data as `const PLACES = [...]`
//   globe.js              - this file
(function () {

  // ------------------------------------------------------------------
  // Tunables - fiddle with these
  // ------------------------------------------------------------------
  var SPIN_SPEED   = 0.02;      // auto-spin, degrees per millisecond (0.02 = 20 deg/s)
  var RESUME_DELAY = 500;       // ms after releasing a drag before auto-spin resumes
  var PIN_COLOR    = '#b00020'; // pin fill (dark red)
  var PIN_MIN_R    = 3.5;       // pin radius floor in px (small screens)
  var PIN_SCALE    = 150;       // pin radius = globe width / this (bigger number = smaller pins)
  var BORDER_COLOR = '#999';    // country + US state borders (gray, works light & dark mode)
  var BORDER_WIDTH = 0.5;       // border line thickness in px (coastlines are 1)
  var START_VIEW   = [95, -25]; // initial rotation [lon, lat]-ish: 95 = center on ~95W (North America)
  var EDGE_MARGIN  = 8;         // px gap between sphere edge and canvas edge

  // ------------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------------
  var container = document.getElementById('globe');
  if (!container) return; // page has no globe div, do nothing

  var canvas = document.createElement('canvas');
  container.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // Decode TopoJSON -> GeoJSON land outlines, build graticule (10 deg lat/lon grid)
  var land = topojson.feature(WORLD_LAND, WORLD_LAND.objects.land);
  // Country borders: mesh with (a !== b) keeps only shared edges between two
  // different countries — i.e. inland borders, no duplicate coastlines
  var borders = topojson.mesh(WORLD_COUNTRIES, WORLD_COUNTRIES.objects.countries,
    function (a, b) { return a !== b; });
  // US state lines are already plain GeoJSON line features
  var stateLines = US_STATE_LINES;
  var graticule = d3.geoGraticule10();
  var sphere = { type: 'Sphere' }; // the globe's outer circle

  // Orthographic projection = "globe seen from space".
  // clipAngle(90) hides everything on the far hemisphere.
  var projection = d3.geoOrthographic().clipAngle(90);
  // geoPath with a canvas context draws projected shapes straight to canvas
  var path = d3.geoPath(projection, ctx);

  // Current rotation. rotation[0] spins east-west, rotation[1] tilts north-south.
  var rotation = [START_VIEW[0], START_VIEW[1]];
  var width = 0, height = 0, dpr = 1;

  // Size canvas to its container, scaled for retina/highDPI screens
  function resize() {
    width = container.clientWidth;
    if (width === 0) return; // container hidden or not laid out yet
    height = width;          // square canvas
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;   // physical pixels
    canvas.height = height * dpr;
    canvas.style.width = width + 'px'; // CSS pixels
    canvas.style.height = height + 'px';
    projection.translate([width / 2, height / 2]).scale(width / 2 - EDGE_MARGIN);
    draw();
  }

  // ------------------------------------------------------------------
  // Drawing - one full repaint of the globe
  // ------------------------------------------------------------------
  function draw() {
    // Line color copies the page text color, so dark mode works automatically
    var ink = getComputedStyle(document.body).color;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    projection.rotate(rotation);

    // 1. Graticule (grid lines) - thin and faded
    ctx.beginPath();
    path(graticule);
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 2. Country borders + US state lines - gray, thinner than coastlines,
    // drawn first so coastlines paint over any overlap
    ctx.beginPath();
    path(borders);
    path(stateLines);
    ctx.lineWidth = BORDER_WIDTH;
    ctx.strokeStyle = BORDER_COLOR;
    ctx.stroke();

    // 3. Land outlines
    ctx.beginPath();
    path(land);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.stroke();

    // 4. Sphere outline (the circle)
    ctx.beginPath();
    path(sphere);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = ink;
    ctx.stroke();

    // 5. Pins - only those on the visible hemisphere.
    // geoDistance returns radians between two points on the sphere;
    // > PI/2 means the pin is around the back. Small margin so pins
    // vanish just before the very edge instead of hanging on the rim.
    var center = [-rotation[0], -rotation[1]]; // lon/lat currently facing the viewer
    var r = Math.max(PIN_MIN_R, width / PIN_SCALE);
    PLACES.forEach(function (p) {
      if (d3.geoDistance([p.lon, p.lat], center) > Math.PI / 2 - 0.05) return;
      var xy = projection([p.lon, p.lat]); // [x, y] canvas coords
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], r, 0, 2 * Math.PI);
      ctx.fillStyle = PIN_COLOR;
      ctx.fill();
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Auto-spin - requestAnimationFrame loop
  // ------------------------------------------------------------------
  // Respect the OS "reduce motion" accessibility setting: no auto-spin,
  // but drag-to-rotate still works.
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var spinning = !reducedMotion;
  var dragging = false;   // true while user holds a drag (and briefly after)
  var idleTimer = null;   // countdown that flips dragging back to false
  var last = null;        // timestamp of previous frame, for time-based speed

  function frame(now) {
    if (spinning && !dragging) {
      // Advance by elapsed time so speed is constant regardless of frame rate
      if (last !== null) rotation[0] += (now - last) * SPIN_SPEED;
      draw();
    }
    last = now;
    requestAnimationFrame(frame); // schedule next frame, forever
  }
  if (spinning) requestAnimationFrame(frame);

  // ------------------------------------------------------------------
  // Drag to rotate (mouse + touch, via d3.drag)
  // ------------------------------------------------------------------
  d3.select(canvas).call(
    d3.drag()
      .on('start', function () {
        dragging = true;
        clearTimeout(idleTimer); // cancel any pending spin-resume
      })
      .on('drag', function (event) {
        // Convert pixels dragged to degrees rotated, scaled so the globe
        // roughly follows the cursor regardless of its size
        var k = 90 / projection.scale();
        rotation[0] += event.dx * k;
        // Clamp tilt so the globe can't flip upside down
        rotation[1] = Math.max(-90, Math.min(90, rotation[1] - event.dy * k));
        draw();
      })
      .on('end', function () {
        // Resume auto-spin a moment after release
        idleTimer = setTimeout(function () { dragging = false; }, RESUME_DELAY);
      })
  );

  window.addEventListener('resize', resize);
  resize(); // initial size + first draw
})();
