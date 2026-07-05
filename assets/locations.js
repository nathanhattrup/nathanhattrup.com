// Visited locations rendered as pins on the globe (index.html).
// To add a place: append { name, lat, lon }. Ballpark coordinates are fine.
const PLACES = [
  // Life
  { name: "Overland Park, KS",            lat: 38.98,  lon: -94.67 },
  { name: "Raleigh, NC",                  lat: 35.78,  lon: -78.64 },

  // School trips
  { name: "New York City, NY",            lat: 40.71,  lon: -74.01 },
  { name: "Morehead City, NC",            lat: 34.72,  lon: -76.71 },
  { name: "Wilmington, NC",               lat: 34.23,  lon: -77.94 },

  // Personal
  { name: "Tokyo, Japan",                 lat: 35.68,  lon: 139.69 },

  // Backpacking
  { name: "Kandersteg, Switzerland",      lat: 46.49,  lon: 7.67 },
  { name: "Linderhof, Germany",           lat: 47.57,  lon: 10.96 },
  { name: "Philmont, NM",                 lat: 36.44,  lon: -104.96 },
  { name: "Northern Tier, MN",            lat: 47.90,  lon: -91.87 },
  { name: "Tahosa, CO",                   lat: 40.10,  lon: -105.51 },
  { name: "Rocky Mountain HAB (Rye), CO", lat: 37.92,  lon: -104.93 },

  // Other travels
  { name: "Boulder, CO",                  lat: 40.01,  lon: -105.27 },
  { name: "Orlando, FL",                  lat: 28.54,  lon: -81.38 },
  { name: "Miami, FL",                    lat: 25.76,  lon: -80.19 },
  { name: "Temple, TX",                   lat: 31.10,  lon: -97.34 },
  { name: "Munich, Germany",              lat: 48.14,  lon: 11.58 },
  { name: "Neuschwanstein Castle, Germany", lat: 47.56, lon: 10.75 },
  { name: "Zurich, Switzerland",          lat: 47.37,  lon: 8.54 },
  { name: "Thun, Switzerland",            lat: 46.76,  lon: 7.63 },
  { name: "Interlaken, Switzerland",      lat: 46.69,  lon: 7.87 },
  { name: "O'ahu, HI",                    lat: 21.47,  lon: -157.98 },
  { name: "Custer, SD",                   lat: 43.77,  lon: -103.60 },
  { name: "Mount Rushmore, SD",           lat: 43.88,  lon: -103.46 },
  { name: "Taos, NM",                     lat: 36.41,  lon: -105.57 },
  { name: "Anaheim, CA",                  lat: 33.84,  lon: -117.91 },

  // --- Kansas ---
  { name: "Wichita, KS",                  lat: 37.69,  lon: -97.34 },
  { name: "Topeka, KS",                   lat: 39.05,  lon: -95.68 },
  { name: "Emporia, KS",                  lat: 38.40,  lon: -96.18 },
  { name: "Lawrence, KS",                 lat: 38.97,  lon: -95.24 },
  { name: "Manhattan, KS",                lat: 39.18,  lon: -96.57 },

  // --- North Carolina ---
  { name: "Boone, NC",                    lat: 36.22,  lon: -81.67 },
  { name: "Myrtle Beach, SC",             lat: 33.69,  lon: -78.89 },  // note: SC, not NC
  { name: "Asheboro, NC",                 lat: 35.71,  lon: -79.81 },
  { name: "Concord, NC",                  lat: 35.41,  lon: -80.58 },
  { name: "Lake Norman, NC",              lat: 35.55,  lon: -80.95 },
  { name: "Durham, NC",                   lat: 35.99,  lon: -78.90 },
  { name: "Chapel Hill, NC",              lat: 35.91,  lon: -79.06 },

  // --- other ---
  { name: "Nellysford, VA",               lat: 37.90,  lon: -78.90 },
  { name: "Galveston, TX",                lat: 29.30,  lon: -94.80 },
  { name: "Oxford, MS",                   lat: 34.37,  lon: -89.52 },
  { name: "South Bend, IN",               lat: 41.68,  lon: -86.25 },
  { name: "Chicago, IL",                  lat: 41.88,  lon: -87.63 }
];
