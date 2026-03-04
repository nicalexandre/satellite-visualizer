
const tleCache = new Map();
const satrecMap = new Map();
const satColorMap = new Map();
let catalog = [];
let selectedNorads = [];
let landFeature = null;
let groundStations = [];
let lastPassForecastMs = 0;
let simTimeMs = Date.now();
let lastTrajectoryRenderMs = 0;
let nextColorIndex = 0;

const DEFAULT_GS = { id: "gs-adelaide", name: "Adelaide", lat: -34.9285, lon: 138.6007, altKm: 0.05, active: true, primary: true };
const EARTH_RADIUS_KM = 6378.137;
const PRESET_PATTERN = /^(CENTAURI|PROXIMA)-\d+$/i;
const CATALOG_CACHE_KEY = "celestrakAllCatalog_v2";
const GS_CACHE_KEY = "groundStations_v1";
const CATALOG_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const PASS_FORECAST_WINDOW_HOURS = 48;
const PASS_FORECAST_STEP_SEC = 30;
const PASS_MIN_ELEVATION_DEG = 5;
const PASS_RECALC_MS = 10 * 60 * 1000;
const WORLD_ATLAS_URL = "https://unpkg.com/world-atlas@2/land-110m.json";
const CATALOG_URL_CANDIDATES = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=all&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
];
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const TRAJECTORY_REFRESH_MS = 220;
const ASSUMED_TOTAL_LOSS_DB = 3;
const SAA_POLYGON = { type: "Polygon", coordinates: [[[-92,-4],[-85,1],[-72,2],[-55,0],[-40,-4],[-28,-8],[-20,-14],[-18,-22],[-22,-30],[-30,-36],[-40,-40],[-50,-39],[-60,-35],[-70,-28],[-78,-20],[-86,-12],[-92,-4]]] };

const statusEl = document.getElementById("status");
const utcEl = document.getElementById("utc");
const epochEl = document.getElementById("epoch");
const cacheInfoEl = document.getElementById("cacheInfo");
const clockModeEl = document.getElementById("clockMode");
const passTitleEl = document.getElementById("passTitle");
const passListEl = document.getElementById("passList");
const statListEl = document.getElementById("statList");
const linkListEl = document.getElementById("linkList");
const satSearchEl = document.getElementById("satSearch");
const satCountsEl = document.getElementById("satCounts");
const satChecklistEl = document.getElementById("satChecklist");
const presetBtn = document.getElementById("presetBtn");
const clearBtn = document.getElementById("clearBtn");
const refreshBtn = document.getElementById("refresh");
const simEnabledEl = document.getElementById("simEnabled");
const simStartEl = document.getElementById("simStart");
const simSpeedEl = document.getElementById("simSpeed");
const simNowEl = document.getElementById("simNow");
const gsNameEl = document.getElementById("gsName");
const gsLatEl = document.getElementById("gsLat");
const gsLonEl = document.getElementById("gsLon");
const gsAltEl = document.getElementById("gsAlt");
const addGsBtn = document.getElementById("addGsBtn");
const gsListEl = document.getElementById("gsList");
const lbFreqEl = document.getElementById("lbFreq");
const lbGsTxEl = document.getElementById("lbGsTx");
const lbGsGainEl = document.getElementById("lbGsGain");
const lbSatTxEl = document.getElementById("lbSatTx");
const lbSatGainEl = document.getElementById("lbSatGain");
const mapEl = document.getElementById("map");
const svgEl = document.getElementById("mapSvg");
const sphereEl = document.getElementById("sphere");
const graticuleEl = document.getElementById("graticule");
const landEl = document.getElementById("land");
const saaZoneEl = document.getElementById("saaZone");
const dayNightEl = document.getElementById("dayNight");
const maskRingEl = document.getElementById("maskRing");
const trajectoriesEl = document.getElementById("trajectories");
const linkLinesEl = document.getElementById("linkLines");
const markersEl = document.getElementById("markers");
const groundStationsEl = document.getElementById("groundStations");

const projection = d3.geoNaturalEarth1();
const pathBuilder = d3.geoPath(projection);
const graticule = d3.geoGraticule10();

function setStatus(msg) { statusEl.textContent = msg; }
function formatDeg(v) { return `${v.toFixed(2)} deg`; }
function formatKm(v) { return `${v.toFixed(1)} km`; }
function formatKms(v) { return `${v.toFixed(3)} km/s`; }
function wrapDegrees(v) { let out = v % 360; if (out < -180) out += 360; if (out > 180) out -= 360; return out; }

function parseTleCatalog(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("1 ")) continue;
    const line1 = lines[i], line2 = lines[i + 1];
    if (!line2 || !line2.startsWith("2 ")) continue;
    const prev = lines[i - 1] || "";
    const name = (!prev.startsWith("1 ") && !prev.startsWith("2 ")) ? prev : "UNKNOWN";
    out.push({ name, norad: line1.slice(2, 7).trim(), line1, line2 });
    i += 1;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function getCachedCatalog() {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.catalog) || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch { return null; }
}

function saveCachedCatalog(records) { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), catalog: records })); }
function setCacheInfo(fetchedAt, label) { cacheInfoEl.textContent = `${label}, ${Math.floor((Date.now() - fetchedAt) / 60000)} min old`; }

function loadGroundStations() {
  try {
    const raw = localStorage.getItem(GS_CACHE_KEY);
    if (!raw) { groundStations = [{ ...DEFAULT_GS }]; return; }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) { groundStations = [{ ...DEFAULT_GS }]; return; }
    groundStations = parsed.map((gs) => ({
      id: String(gs.id || `gs-${Math.random().toString(36).slice(2)}`),
      name: String(gs.name || "Ground Station"),
      lat: Number(gs.lat), lon: Number(gs.lon), altKm: Number(gs.altKm) || 0,
      active: gs.active !== false, primary: gs.primary === true
    })).filter((gs) => Number.isFinite(gs.lat) && Number.isFinite(gs.lon));
    if (!groundStations.length) groundStations = [{ ...DEFAULT_GS }];
    if (!groundStations.some((gs) => gs.primary)) groundStations[0].primary = true;
  } catch { groundStations = [{ ...DEFAULT_GS }]; }
}

function saveGroundStations() { localStorage.setItem(GS_CACHE_KEY, JSON.stringify(groundStations)); }
function getPrimaryGroundStation() { return groundStations.find((gs) => gs.primary) || groundStations[0] || { ...DEFAULT_GS }; }

function renderGroundStationList() {
  gsListEl.innerHTML = "";
  for (const gs of groundStations) {
    const item = document.createElement("div"); item.className = "gs-item";
    const left = document.createElement("div");
    left.textContent = `${gs.name} | ${gs.lat.toFixed(4)}, ${gs.lon.toFixed(4)} | ${gs.altKm.toFixed(3)} km`;
    const actions = document.createElement("div"); actions.className = "gs-actions";
    const activeLabel = document.createElement("label");
    const activeCb = document.createElement("input"); activeCb.type = "checkbox"; activeCb.checked = gs.active;
    activeCb.addEventListener("change", () => { gs.active = activeCb.checked; saveGroundStations(); renderGroundStationList(); renderPassForecast(); });
    activeLabel.appendChild(activeCb); activeLabel.appendChild(document.createTextNode(" Active"));
    const primaryBtn = document.createElement("button");
    primaryBtn.textContent = gs.primary ? "Primary" : "Set Primary"; primaryBtn.disabled = gs.primary;
    primaryBtn.addEventListener("click", () => { groundStations.forEach((e) => { e.primary = e.id === gs.id; }); saveGroundStations(); renderGroundStationList(); renderPassForecast(); });
    const removeBtn = document.createElement("button"); removeBtn.textContent = "Remove"; removeBtn.disabled = groundStations.length === 1;
    removeBtn.addEventListener("click", () => { groundStations = groundStations.filter((e) => e.id !== gs.id); if (!groundStations.some((e) => e.primary) && groundStations.length) groundStations[0].primary = true; saveGroundStations(); renderGroundStationList(); renderPassForecast(); });
    actions.appendChild(activeLabel); actions.appendChild(primaryBtn); actions.appendChild(removeBtn);
    item.appendChild(left); item.appendChild(actions); gsListEl.appendChild(item);
  }
}

function addGroundStationFromForm() {
  const name = gsNameEl.value.trim(); const lat = Number(gsLatEl.value); const lon = Number(gsLonEl.value);
  const altKm = gsAltEl.value.trim() === "" ? 0 : Number(gsAltEl.value);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altKm)) { setStatus("Ground station fields invalid."); return; }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { setStatus("Ground station coordinates out of range."); return; }
  groundStations.push({ id: `gs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, lat, lon, altKm, active: true, primary: groundStations.length === 0 });
  saveGroundStations(); renderGroundStationList(); gsNameEl.value = ""; gsLatEl.value = ""; gsLonEl.value = ""; gsAltEl.value = "";
}

function readLinkBudgetInputs() {
  return { freqMHz: Number(lbFreqEl.value) || 437, gsTxDbm: Number(lbGsTxEl.value) || 30, gsGainDbi: Number(lbGsGainEl.value) || 12, satTxDbm: Number(lbSatTxEl.value) || 27, satGainDbi: Number(lbSatGainEl.value) || 3 };
}

function calcFsplDb(freqMHz, rangeKm) { return 32.44 + 20 * Math.log10(Math.max(rangeKm, 0.001)) + 20 * Math.log10(Math.max(freqMHz, 1)); }
function calcLinkBudget(rangeKm, b) { const fspl = calcFsplDb(b.freqMHz, rangeKm); return { fspl, rxSatDbm: b.gsTxDbm + b.gsGainDbi + b.satGainDbi - fspl - ASSUMED_TOTAL_LOSS_DB, rxGsDbm: b.satTxDbm + b.satGainDbi + b.gsGainDbi - fspl - ASSUMED_TOTAL_LOSS_DB }; }
async function fetchCatalogFromCelestrak() {
  let lastError = null;
  for (const url of CATALOG_URL_CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseTleCatalog((await res.text()).trim());
      if (parsed.length) return parsed;
      throw new Error("Empty catalog");
    } catch (err) { lastError = err; }
  }
  throw new Error(`Failed all CelesTrak catalog endpoints: ${lastError?.message || "unknown"}`);
}

function makePresetSelection(records) { return records.filter((r) => PRESET_PATTERN.test(r.name)).map((r) => r.norad); }
function updateSatCounts(filteredCount) { satCountsEl.textContent = `${filteredCount} shown / ${catalog.length} total | ${selectedNorads.length} selected`; }

function renderSatelliteChecklist() {
  const q = satSearchEl.value.trim().toLowerCase();
  const selectedSet = new Set(selectedNorads);
  const filtered = catalog.filter((rec) => !q || rec.name.toLowerCase().includes(q) || rec.norad.includes(q));
  satChecklistEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const rec of filtered) {
    const label = document.createElement("label"); label.className = "sat-option";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = rec.norad; cb.checked = selectedSet.has(rec.norad);
    cb.addEventListener("change", async () => {
      if (cb.checked) { if (!selectedNorads.includes(rec.norad)) selectedNorads.push(rec.norad); }
      else selectedNorads = selectedNorads.filter((id) => id !== rec.norad);
      assignSatelliteColors(selectedNorads); updateSatCounts(filtered.length); await loadSelectedSatellites();
    });
    const t = document.createElement("span"); t.textContent = `${rec.name} (${rec.norad})`;
    label.appendChild(cb); label.appendChild(t); frag.appendChild(label);
  }
  satChecklistEl.appendChild(frag);
  updateSatCounts(filtered.length);
}

function colorForNorad(norad) {
  if (!satColorMap.has(norad)) { satColorMap.set(norad, `hsl(${((nextColorIndex * 137.508) % 360).toFixed(1)} 88% 62%)`); nextColorIndex += 1; }
  return satColorMap.get(norad);
}

function assignSatelliteColors(norads) { for (const norad of norads) colorForNorad(norad); }

async function loadCatalog(forceReload = false) {
  const cached = getCachedCatalog();
  const nowMs = Date.now();
  if (!forceReload && cached && nowMs - cached.fetchedAt <= CATALOG_MAX_AGE_MS) {
    catalog = cached.catalog;
    if (!selectedNorads.length) selectedNorads = makePresetSelection(catalog);
    assignSatelliteColors(selectedNorads); renderSatelliteChecklist(); setCacheInfo(cached.fetchedAt, "local cache"); setStatus(`Loaded ${catalog.length} satellites from cache.`);
    return;
  }
  setStatus("Refreshing full catalog from CelesTrak...");
  try {
    catalog = await fetchCatalogFromCelestrak(); saveCachedCatalog(catalog);
    if (!selectedNorads.length) selectedNorads = makePresetSelection(catalog);
    else { const valid = new Set(catalog.map((r) => r.norad)); selectedNorads = selectedNorads.filter((id) => valid.has(id)); }
    assignSatelliteColors(selectedNorads); renderSatelliteChecklist(); setCacheInfo(Date.now(), "CelesTrak fresh fetch"); setStatus(`Loaded ${catalog.length} satellites from CelesTrak.`);
  } catch (err) {
    if (!cached) throw err;
    catalog = cached.catalog;
    if (!selectedNorads.length) selectedNorads = makePresetSelection(catalog);
    assignSatelliteColors(selectedNorads); renderSatelliteChecklist(); setCacheInfo(cached.fetchedAt, "stale cache fallback"); setStatus(`Using stale cache due to fetch error: ${err.message}`);
  }
}

function tleEpochToDate(line1) {
  const yy = parseInt(line1.slice(18, 20), 10), dd = parseFloat(line1.slice(20, 32));
  const full = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(full, 0, 1) + (dd - 1) * 86400000);
}

async function loadSelectedSatellites() {
  satrecMap.clear(); tleCache.clear();
  if (!selectedNorads.length) {
    epochEl.textContent = "-"; passListEl.innerHTML = ""; linkListEl.innerHTML = ""; statListEl.innerHTML = "";
    trajectoriesEl.innerHTML = ""; markersEl.innerHTML = ""; linkLinesEl.innerHTML = ""; setStatus("No satellites selected."); return;
  }
  const epochs = [];
  for (const norad of selectedNorads) {
    const rec = catalog.find((r) => r.norad === norad); if (!rec) continue;
    tleCache.set(norad, { name: rec.name, line1: rec.line1, line2: rec.line2 });
    satrecMap.set(norad, satellite.twoline2satrec(rec.line1, rec.line2));
    epochs.push(`${rec.name}: ${tleEpochToDate(rec.line1).toISOString()}`);
  }
  epochEl.textContent = epochs.join(" | "); setStatus(`Tracking ${satrecMap.size} satellite(s).`);
  renderTrajectory(getCurrentTime()); renderPassForecast(); lastPassForecastMs = Date.now();
}

function toDateTimeLocalValue(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function getSimulationSpeed() { return Number(simSpeedEl.value || 1); }
function getCurrentTime() { return simEnabledEl.checked ? new Date(simTimeMs) : new Date(); }
function updateClockMode() { clockModeEl.textContent = simEnabledEl.checked ? `SIM (${getSimulationSpeed()}x)` : "REAL"; }

function propagateSatelliteAt(norad, atDate) {
  const satrec = satrecMap.get(norad); if (!satrec) return null;
  const pv = satellite.propagate(satrec, atDate); if (!pv.position || !pv.velocity) return null;
  const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(atDate));
  return { name: catalog.find((c) => c.norad === norad)?.name || norad, norad, lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude), altKm: gd.height, positionEci: pv.position, velocityEci: pv.velocity };
}

function fitProjection() {
  const r = mapEl.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
  svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  projection.fitExtent([[10, 10], [w - 10, h - 10]], { type: "Sphere" });
  sphereEl.setAttribute("d", pathBuilder({ type: "Sphere" }));
  graticuleEl.setAttribute("d", pathBuilder(graticule));
  if (landFeature) landEl.setAttribute("d", pathBuilder(landFeature));
  saaZoneEl.setAttribute("d", pathBuilder(SAA_POLYGON));
}

function computeSubsolarPoint(date) {
  const jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const M = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  const ecl = (L + 1.915 * Math.sin(M) + 0.020 * Math.sin(2 * M)) * (Math.PI / 180);
  const obl = (23.439 - 0.0000004 * n) * (Math.PI / 180);
  const dec = Math.asin(Math.sin(obl) * Math.sin(ecl));
  const ra = Math.atan2(Math.cos(obl) * Math.sin(ecl), Math.cos(ecl));
  const t = (jd - 2451545.0) / 36525.0;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
  return { lon: wrapDegrees((ra * 180) / Math.PI - gmst), lat: (dec * 180) / Math.PI };
}

function renderDayNight(now) {
  const ss = computeSubsolarPoint(now);
  dayNightEl.setAttribute("d", pathBuilder(d3.geoCircle().center([wrapDegrees(ss.lon + 180), -ss.lat]).radius(90).precision(1)()));
}

function computeMaskRadiusDeg(altKm, elevDeg) {
  const r = EARTH_RADIUS_KM + Math.max(0, altKm), elev = (elevDeg * Math.PI) / 180, horizon = Math.acos(EARTH_RADIUS_KM / r);
  let lo = 0, hi = horizon;
  for (let i = 0; i < 32; i += 1) {
    const mid = 0.5 * (lo + hi);
    const f = Math.atan2(Math.cos(mid) - EARTH_RADIUS_KM / r, Math.sin(mid)) - elev;
    if (f > 0) lo = mid; else hi = mid;
  }
  return (0.5 * (lo + hi) * 180) / Math.PI;
}
function renderGroundStationsMap() {
  groundStationsEl.innerHTML = "";
  for (const gs of groundStations.filter((g) => g.active)) {
    const xy = projection([gs.lon, gs.lat]); if (!xy) continue;
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", xy[0]); dot.setAttribute("cy", xy[1]); dot.setAttribute("r", gs.primary ? 4.6 : 3.8); dot.setAttribute("class", "ground-dot");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", xy[0] + 7); label.setAttribute("y", xy[1] - 7); label.setAttribute("class", "ground-label"); label.textContent = gs.name;
    groundStationsEl.appendChild(dot); groundStationsEl.appendChild(label);
  }
}

function renderMaskForPrimary(nowStates) {
  const p = getPrimaryGroundStation();
  const alt = nowStates.length ? nowStates[0].altKm : 550;
  maskRingEl.setAttribute("d", pathBuilder(d3.geoCircle().center([p.lon, p.lat]).radius(computeMaskRadiusDeg(alt, PASS_MIN_ELEVATION_DEG)).precision(1)()));
}

function buildTrajectoryLine(norad, now) {
  const satrec = satrecMap.get(norad); if (!satrec) return null;
  const coords = [];
  for (let t = now.getTime() - 20 * 60 * 1000; t <= now.getTime() + 100 * 60 * 1000; t += 60 * 1000) {
    const d = new Date(t), pv = satellite.propagate(satrec, d); if (!pv.position) continue;
    const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(d));
    coords.push([satellite.degreesLong(gd.longitude), satellite.degreesLat(gd.latitude)]);
  }
  if (coords.length < 2) return null;
  return { type: "LineString", coordinates: coords };
}

function renderTrajectory(now) {
  trajectoriesEl.innerHTML = "";
  for (const norad of selectedNorads) {
    const line = buildTrajectoryLine(norad, now); if (!line) continue;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", pathBuilder(line)); p.setAttribute("class", "trajectory"); p.setAttribute("stroke", colorForNorad(norad));
    trajectoriesEl.appendChild(p);
  }
}

function renderMarkers(nowStates) {
  markersEl.innerHTML = "";
  for (const st of nowStates) {
    const xy = projection([st.lon, st.lat]); if (!xy) continue;
    const color = colorForNorad(st.norad);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", xy[0]); dot.setAttribute("cy", xy[1]); dot.setAttribute("r", 5.1); dot.setAttribute("fill", color); dot.setAttribute("class", "sat-dot");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", xy[0] + 8); label.setAttribute("y", xy[1] - 8); label.setAttribute("fill", color); label.setAttribute("font-size", "11"); label.setAttribute("paint-order", "stroke"); label.setAttribute("stroke", "rgba(8,18,29,0.8)"); label.setAttribute("stroke-width", "2"); label.textContent = st.name;
    markersEl.appendChild(dot); markersEl.appendChild(label);
  }
}

function renderStats(nowStates) {
  statListEl.innerHTML = "";
  if (!nowStates.length) { const e = document.createElement("div"); e.className = "stat-card"; e.textContent = "No satellites selected."; statListEl.appendChild(e); return; }
  for (const st of nowStates) {
    const c = document.createElement("div"); c.className = "stat-card"; c.style.borderLeft = `4px solid ${colorForNorad(st.norad)}`;
    c.textContent = `${st.name} (${st.norad}) | Lat ${formatDeg(st.lat)} Lon ${formatDeg(st.lon)} Alt ${formatKm(st.altKm)} | X ${formatKm(st.positionEci.x)} Y ${formatKm(st.positionEci.y)} Z ${formatKm(st.positionEci.z)} | Vx ${formatKms(st.velocityEci.x)} Vy ${formatKms(st.velocityEci.y)} Vz ${formatKms(st.velocityEci.z)}`;
    statListEl.appendChild(c);
  }
}

function calculateLiveLinks(nowStates, now) {
  linkLinesEl.innerHTML = ""; linkListEl.innerHTML = "";
  const activeStations = groundStations.filter((gs) => gs.active);
  if (!activeStations.length || !nowStates.length) { const li = document.createElement("li"); li.textContent = "No active links (select satellites and enable at least one ground station)."; linkListEl.appendChild(li); return; }
  const gmst = satellite.gstime(now), budget = readLinkBudgetInputs(), links = [];
  for (const st of nowStates) {
    const satEcf = satellite.eciToEcf(st.positionEci, gmst);
    for (const gs of activeStations) {
      const obs = { latitude: satellite.degreesToRadians(gs.lat), longitude: satellite.degreesToRadians(gs.lon), height: gs.altKm };
      const look = satellite.ecfToLookAngles(obs, satEcf), elev = satellite.radiansToDegrees(look.elevation);
      if (elev <= 0) continue;
      const rangeKm = look.rangeSat, lb = calcLinkBudget(rangeKm, budget);
      links.push({ sat: st, gs, elev, rangeKm, ...lb });
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", pathBuilder({ type: "LineString", coordinates: [[gs.lon, gs.lat], [st.lon, st.lat]] }));
      p.setAttribute("class", "link-line"); linkLinesEl.appendChild(p);
    }
  }
  links.sort((a, b) => b.elev - a.elev);
  if (!links.length) { const li = document.createElement("li"); li.textContent = "No satellite currently above local horizon for active ground stations."; linkListEl.appendChild(li); return; }
  for (const link of links.slice(0, 120)) {
    const li = document.createElement("li");
    li.textContent = `${link.gs.name} <-> ${link.sat.name} | Elev ${link.elev.toFixed(1)} deg | Range ${link.rangeKm.toFixed(1)} km | Rx@SAT ${link.rxSatDbm.toFixed(1)} dBm | Rx@GS ${link.rxGsDbm.toFixed(1)} dBm`;
    linkListEl.appendChild(li);
  }
}

function refineCrossing(t1, e1, t2, e2) { const f = (PASS_MIN_ELEVATION_DEG - e1) / (e2 - e1); return new Date(t1.getTime() + f * (t2.getTime() - t1.getTime())); }

function computePassForecast(norad, station, startDate, hoursAhead) {
  const satrec = satrecMap.get(norad); if (!satrec) return [];
  const obs = { latitude: satellite.degreesToRadians(station.lat), longitude: satellite.degreesToRadians(station.lon), height: station.altKm };
  const endDate = new Date(startDate.getTime() + hoursAhead * 3600 * 1000), stepMs = PASS_FORECAST_STEP_SEC * 1000;
  let prevDate = null, prevElev = null, inPass = false, cur = null; const out = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += stepMs) {
    const d = new Date(t), pv = satellite.propagate(satrec, d); if (!pv.position) continue;
    const look = satellite.ecfToLookAngles(obs, satellite.eciToEcf(pv.position, satellite.gstime(d))), elev = satellite.radiansToDegrees(look.elevation);
    if (prevDate !== null && prevElev !== null) {
      if (!inPass && prevElev <= PASS_MIN_ELEVATION_DEG && elev > PASS_MIN_ELEVATION_DEG) { inPass = true; cur = { rise: refineCrossing(prevDate, prevElev, d, elev), set: null, maxElevation: elev, maxTime: d }; }
      if (inPass && cur) {
        if (elev > cur.maxElevation) { cur.maxElevation = elev; cur.maxTime = d; }
        if (prevElev > PASS_MIN_ELEVATION_DEG && elev <= PASS_MIN_ELEVATION_DEG) { cur.set = refineCrossing(prevDate, prevElev, d, elev); out.push(cur); inPass = false; cur = null; }
      }
    }
    prevDate = d; prevElev = elev;
  }
  if (inPass && cur) { cur.set = endDate; out.push(cur); }
  return out;
}

function renderPassForecast() {
  passListEl.innerHTML = "";
  const primary = getPrimaryGroundStation();
  passTitleEl.textContent = primary.name;
  if (!selectedNorads.length) return;
  const now = getCurrentTime(), entries = [];
  for (const norad of selectedNorads) {
    const name = catalog.find((c) => c.norad === norad)?.name || norad;
    for (const pass of computePassForecast(norad, primary, now, PASS_FORECAST_WINDOW_HOURS)) entries.push({ name, ...pass });
  }
  entries.sort((a, b) => a.rise - b.rise);
  if (!entries.length) { const li = document.createElement("li"); li.textContent = `No passes above 5 deg for ${primary.name} in the next 48 hours.`; passListEl.appendChild(li); return; }
  for (const pass of entries.slice(0, 80)) {
    const li = document.createElement("li");
    li.textContent = `${pass.name} | Rise ${pass.rise.toISOString().replace("T", " ").slice(0, 16)} UTC | Max ${pass.maxTime.toISOString().replace("T", " ").slice(0, 16)} UTC (${pass.maxElevation.toFixed(1)} deg) | Set ${pass.set.toISOString().replace("T", " ").slice(0, 16)} UTC`;
    passListEl.appendChild(li);
  }
}

async function loadWorldData() {
  const res = await fetch(WORLD_ATLAS_URL, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed world map data fetch (${res.status})`);
  const topo = await res.json();
  landFeature = topojson.feature(topo, topo.objects.land);
}

function applySimulationControlsState() {
  const enabled = simEnabledEl.checked;
  simStartEl.disabled = !enabled; simSpeedEl.disabled = !enabled; simNowEl.disabled = !enabled;
  updateClockMode();
}

function updateSimulationClock(dtMs) { if (simEnabledEl.checked) simTimeMs += dtMs * getSimulationSpeed(); }

function tick(dtMs = FRAME_MS) {
  updateSimulationClock(dtMs);
  const now = getCurrentTime();
  utcEl.textContent = now.toISOString();
  const nowStates = [];
  for (const norad of selectedNorads) { const st = propagateSatelliteAt(norad, now); if (st) nowStates.push(st); }
  renderDayNight(now); renderMaskForPrimary(nowStates); renderGroundStationsMap(); renderMarkers(nowStates); renderStats(nowStates); calculateLiveLinks(nowStates, now);
  const nowReal = Date.now();
  if (nowReal - lastTrajectoryRenderMs >= TRAJECTORY_REFRESH_MS) { renderTrajectory(now); lastTrajectoryRenderMs = nowReal; }
  if (nowReal - lastPassForecastMs > PASS_RECALC_MS) { renderPassForecast(); lastPassForecastMs = nowReal; }
}

function startAnimationLoop() {
  let previous = performance.now(), acc = 0;
  function frame(ts) { const delta = ts - previous; previous = ts; acc += delta; while (acc >= FRAME_MS) { tick(FRAME_MS); acc -= FRAME_MS; } requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
}

async function bootstrap() {
  try {
    loadGroundStations(); renderGroundStationList(); applySimulationControlsState(); simStartEl.value = toDateTimeLocalValue(Date.now());
    await loadWorldData();
    fitProjection(); await loadCatalog(false); await loadSelectedSatellites(); tick(FRAME_MS); startAnimationLoop();
  } catch (err) { setStatus(`Error: ${err.message}`); }
}

satSearchEl.addEventListener("input", renderSatelliteChecklist);
presetBtn.addEventListener("click", async () => { selectedNorads = makePresetSelection(catalog); assignSatelliteColors(selectedNorads); renderSatelliteChecklist(); await loadSelectedSatellites(); });
clearBtn.addEventListener("click", async () => { selectedNorads = []; renderSatelliteChecklist(); await loadSelectedSatellites(); });
refreshBtn.addEventListener("click", async () => { try { await loadCatalog(true); await loadSelectedSatellites(); } catch (err) { setStatus(`Error: ${err.message}`); } });
simEnabledEl.addEventListener("change", () => { if (simEnabledEl.checked) { simTimeMs = Date.now(); simStartEl.value = toDateTimeLocalValue(simTimeMs); } applySimulationControlsState(); renderPassForecast(); });
simStartEl.addEventListener("change", () => { if (!simStartEl.value) return; const d = new Date(simStartEl.value); if (!Number.isNaN(d.getTime())) { simTimeMs = d.getTime(); renderPassForecast(); } });
simSpeedEl.addEventListener("change", () => { updateClockMode(); renderPassForecast(); });
simNowEl.addEventListener("click", () => { simTimeMs = Date.now(); simStartEl.value = toDateTimeLocalValue(simTimeMs); renderPassForecast(); });
addGsBtn.addEventListener("click", addGroundStationFromForm);
[lbFreqEl, lbGsTxEl, lbGsGainEl, lbSatTxEl, lbSatGainEl].forEach((el) => el.addEventListener("input", () => tick(0)));
window.addEventListener("resize", () => { fitProjection(); renderTrajectory(getCurrentTime()); tick(FRAME_MS); });

bootstrap();
