
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
let lastDopplerRenderMs = 0;
let nextColorIndex = 0;
let passEntries = [];
let selectedPassKey = "";
let trajBackMinutes = 20;
let trajForwardMinutes = 100;

const DEFAULT_GS = { id: "gs-adelaide", name: "Adelaide", lat: -34.9285, lon: 138.6007, altKm: 0.05, active: true, primary: true };
const EARTH_RADIUS_KM = 6378.137;
const PRESET_PATTERN = /^(CENTAURI|PROXIMA)-\d+$/i;
const MAJOR_CITIES = [
  { name: "Santiago, Chile", lat: -33.4489, lon: -70.6693, altKm: 0.57 },
  { name: "Adelaide, Australia", lat: -34.9285, lon: 138.6007, altKm: 0.05 },
  { name: "Sydney, Australia", lat: -33.8688, lon: 151.2093, altKm: 0.058 },
  { name: "Melbourne, Australia", lat: -37.8136, lon: 144.9631, altKm: 0.031 },
  { name: "Auckland, New Zealand", lat: -36.8509, lon: 174.7645, altKm: 0.03 },
  { name: "Wellington, New Zealand", lat: -41.2865, lon: 174.7762, altKm: 0.015 },
  { name: "Punta Arenas, Chile", lat: -53.1638, lon: -70.9171, altKm: 0.037 },
  { name: "La Paz, Mexico", lat: 24.1426, lon: -110.3128, altKm: 0.018 },
  { name: "Pretoria, South Africa", lat: -25.7479, lon: 28.2293, altKm: 1.339 },
  { name: "Cape Town, South Africa", lat: -33.9249, lon: 18.4241, altKm: 0.025 },
  { name: "Reykjavik, Iceland", lat: 64.1466, lon: -21.9426, altKm: 0.061 },
  { name: "Kandy, Sri Lanka", lat: 7.2906, lon: 80.6337, altKm: 0.5 },
  { name: "Colombo, Sri Lanka", lat: 6.9271, lon: 79.8612, altKm: 0.006 },
  { name: "Port Louis, Mauritius", lat: -20.1609, lon: 57.5012, altKm: 0.01 },
  { name: "Ponta Delgada, Azores, Portugal", lat: 37.7412, lon: -25.6756, altKm: 0.02 },
  { name: "Lisbon, Portugal", lat: 38.7223, lon: -9.1393, altKm: 0.002 },
  { name: "Baku, Azerbaijan", lat: 40.4093, lon: 49.8671, altKm: 0.028 },
  { name: "Sao Paulo, Brazil", lat: -23.5505, lon: -46.6333, altKm: 0.76 },
  { name: "Houston, USA", lat: 29.7604, lon: -95.3698, altKm: 0.013 },
  { name: "Tokyo, Japan", lat: 35.6762, lon: 139.6503, altKm: 0.04 }
];
const CATALOG_CACHE_KEY = "celestrakAllCatalog_v2";
const GS_CACHE_KEY = "groundStations_v1";
const CATALOG_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const PASS_FORECAST_WINDOW_HOURS = 48;
const PASS_FORECAST_STEP_SEC = 30;
const PASS_MIN_ELEVATION_DEG = 5;
const PASS_LIST_GRACE_MS = 10 * 60 * 1000;
const PASS_RECALC_MS = 10 * 60 * 1000;
const WORLD_ATLAS_URL = "https://unpkg.com/world-atlas@2/land-110m.json";
const CATALOG_URL_CANDIDATES = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=all&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
];
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const TRAJECTORY_REFRESH_MS = 220;
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
const skyGsNameEl = document.getElementById("skyGsName");
const skyCanvasEl = document.getElementById("skyCanvas");
const dopplerCanvasEl = document.getElementById("dopplerCanvas");
const dopplerInfoEl = document.getElementById("dopplerInfo");
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
const timeLocalToggleEl = document.getElementById("timeLocalToggle");
const timeCustomToggleEl = document.getElementById("timeCustomToggle");
const timeZoneInputEl = document.getElementById("timeZoneInput");
const timeZoneLabelEl = document.getElementById("timeZoneLabel");
const gsNameEl = document.getElementById("gsName");
const gsLatEl = document.getElementById("gsLat");
const gsLonEl = document.getElementById("gsLon");
const gsAltEl = document.getElementById("gsAlt");
const majorCitiesListEl = document.getElementById("majorCitiesList");
const addGsBtn = document.getElementById("addGsBtn");
const gsListEl = document.getElementById("gsList");
const lbUplinkFreqEl = document.getElementById("lbUplinkFreq");
const lbUplinkTxPowerEl = document.getElementById("lbUplinkTxPower");
const lbUplinkTxGainEl = document.getElementById("lbUplinkTxGain");
const lbUplinkRxGainEl = document.getElementById("lbUplinkRxGain");
const lbUplinkRxAmpEl = document.getElementById("lbUplinkRxAmp");
const lbUplinkLossesEl = document.getElementById("lbUplinkLosses");
const lbDownlinkFreqEl = document.getElementById("lbDownlinkFreq");
const lbDownlinkTxPowerEl = document.getElementById("lbDownlinkTxPower");
const lbDownlinkTxGainEl = document.getElementById("lbDownlinkTxGain");
const lbDownlinkRxGainEl = document.getElementById("lbDownlinkRxGain");
const lbDownlinkRxAmpEl = document.getElementById("lbDownlinkRxAmp");
const lbDownlinkLossesEl = document.getElementById("lbDownlinkLosses");
const trajBackMinEl = document.getElementById("trajBackMin");
const trajForwardMinEl = document.getElementById("trajForwardMin");
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

function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date()); return true; } catch { return false; }
}

function resolveTimeDisplayConfig() {
  if (timeCustomToggleEl.checked) {
    const custom = timeZoneInputEl.value.trim();
    if (custom && isValidTimeZone(custom)) return { mode: "custom", timeZone: custom, label: custom };
    return { mode: "utc", timeZone: "UTC", label: "UTC (invalid custom TZ)" };
  }
  if (timeLocalToggleEl.checked) return { mode: "local", timeZone: undefined, label: "Local" };
  return { mode: "utc", timeZone: "UTC", label: "UTC" };
}

function updateTimeControlsUI() {
  timeZoneInputEl.disabled = !timeCustomToggleEl.checked;
  const cfg = resolveTimeDisplayConfig();
  timeZoneLabelEl.textContent = cfg.label;
}

function formatDateTimeDisplay(date, withSeconds = true) {
  const cfg = resolveTimeDisplayConfig();
  if (cfg.mode === "utc") {
    const iso = date.toISOString().replace("T", " ");
    return withSeconds ? `${iso.slice(0, 19)} UTC` : `${iso.slice(0, 16)} UTC`;
  }
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: cfg.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false
  });
  const parts = dtf.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const base = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  const full = withSeconds ? `${base}:${get("second")}` : base;
  return `${full} ${cfg.label}`;
}

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

function populateCityDatalist() {
  if (!majorCitiesListEl) return;
  majorCitiesListEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const city of MAJOR_CITIES) {
    const opt = document.createElement("option");
    opt.value = city.name;
    frag.appendChild(opt);
  }
  majorCitiesListEl.appendChild(frag);
}

function tryAutofillGroundStationCity() {
  const q = gsNameEl.value.trim().toLowerCase();
  if (!q) return;
  const match = MAJOR_CITIES.find((c) => c.name.toLowerCase() === q);
  if (!match) return;
  gsLatEl.value = String(match.lat);
  gsLonEl.value = String(match.lon);
  gsAltEl.value = String(match.altKm);
}

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
  tryAutofillGroundStationCity();
  const name = gsNameEl.value.trim(); const lat = Number(gsLatEl.value); const lon = Number(gsLonEl.value);
  const altKm = gsAltEl.value.trim() === "" ? 0 : Number(gsAltEl.value);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altKm)) { setStatus("Ground station fields invalid."); return; }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { setStatus("Ground station coordinates out of range."); return; }
  groundStations.push({ id: `gs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, lat, lon, altKm, active: true, primary: groundStations.length === 0 });
  saveGroundStations(); renderGroundStationList(); gsNameEl.value = ""; gsLatEl.value = ""; gsLonEl.value = ""; gsAltEl.value = "";
}

function readLinkBudgetInputs() {
  return {
    uplinkFreqMHz: Number(lbUplinkFreqEl.value) || 2065,
    uplinkTxPowerDbm: Number(lbUplinkTxPowerEl.value) || 33,
    uplinkTxGainDbi: Number(lbUplinkTxGainEl.value) || 25,
    uplinkRxGainDbi: Number(lbUplinkRxGainEl.value) || 6,
    uplinkRxAmpDb: Number(lbUplinkRxAmpEl.value) || 20,
    uplinkLossesDb: Number(lbUplinkLossesEl.value) || 1,
    downlinkFreqMHz: Number(lbDownlinkFreqEl.value) || 2265,
    downlinkTxPowerDbm: Number(lbDownlinkTxPowerEl.value) || 33,
    downlinkTxGainDbi: Number(lbDownlinkTxGainEl.value) || 6,
    downlinkRxGainDbi: Number(lbDownlinkRxGainEl.value) || 25,
    downlinkRxAmpDb: Number(lbDownlinkRxAmpEl.value) || 30,
    downlinkLossesDb: Number(lbDownlinkLossesEl.value) || 1
  };
}

function calcFsplDb(freqMHz, rangeKm) { return 32.44 + 20 * Math.log10(Math.max(rangeKm, 0.001)) + 20 * Math.log10(Math.max(freqMHz, 1)); }
function calcLinkBudget(rangeKm, b) {
  const fsplUplink = calcFsplDb(b.uplinkFreqMHz, rangeKm);
  const fsplDownlink = calcFsplDb(b.downlinkFreqMHz, rangeKm);
  const rxSatDbm = b.uplinkTxPowerDbm + b.uplinkTxGainDbi + b.uplinkRxGainDbi + b.uplinkRxAmpDb - fsplUplink - b.uplinkLossesDb;
  const rxGsDbm = b.downlinkTxPowerDbm + b.downlinkTxGainDbi + b.downlinkRxGainDbi + b.downlinkRxAmpDb - fsplDownlink - b.downlinkLossesDb;
  return { fsplUplink, fsplDownlink, rxSatDbm, rxGsDbm };
}
function getCarrierHzes() {
  const b = readLinkBudgetInputs();
  return { uplinkHz: b.uplinkFreqMHz * 1e6, downlinkHz: b.downlinkFreqMHz * 1e6 };
}

function computeLookFromStation(station, satState, now) {
  const gmst = satellite.gstime(now);
  const satEcf = satellite.eciToEcf(satState.positionEci, gmst);
  const observer = {
    latitude: satellite.degreesToRadians(station.lat),
    longitude: satellite.degreesToRadians(station.lon),
    height: station.altKm
  };
  return satellite.ecfToLookAngles(observer, satEcf);
}

function skyPointFromLook(look, cx, cy, R) {
  const elevDeg = satellite.radiansToDegrees(look.elevation);
  if (elevDeg < 0) return null;
  const rho = R * ((90 - elevDeg) / 90);
  return {
    x: cx + rho * Math.sin(look.azimuth),
    y: cy - rho * Math.cos(look.azimuth),
    elevDeg
  };
}

function updatePassSelectionUI() {
  const buttons = passListEl.querySelectorAll(".pass-item-btn");
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.passKey === selectedPassKey);
  });
}

function getOrbitPeriodMinutes(norad) {
  const satrec = satrecMap.get(norad);
  if (!satrec || !Number.isFinite(satrec.no) || satrec.no <= 0) return 96;
  return (2 * Math.PI) / satrec.no;
}

function drawSkyView(nowStates, now) {
  const ctx = skyCanvasEl.getContext("2d");
  const w = skyCanvasEl.width;
  const h = skyCanvasEl.height;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.44;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(7,19,31,0.9)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(133,178,209,0.7)";
  ctx.lineWidth = 1;
  for (const elev of [0, 30, 60]) {
    const rr = R * ((90 - elev) / 90);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(133,178,209,0.45)";
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

  ctx.fillStyle = "#d2ecff";
  ctx.font = "14px 'Space Grotesk', sans-serif";
  ctx.fillText("N", cx - 5, cy - R - 8);
  ctx.fillText("S", cx - 4, cy + R + 18);
  ctx.fillText("W", cx - R - 18, cy + 4);
  ctx.fillText("E", cx + R + 8, cy + 4);
  ctx.fillStyle = "#9fc1db";
  ctx.fillText("Horizon", 10, h - 10);

  const station = getPrimaryGroundStation();
  skyGsNameEl.textContent = station.name;

  const selectedPass = selectedPassKey ? passEntries.find((p) => p.key === selectedPassKey) : null;
  if (selectedPass) {
    const satrec = satrecMap.get(selectedPass.norad);
    if (satrec) {
      const passPts = [];
      const passStepMs = 20 * 1000;
      for (let t = selectedPass.rise.getTime(); t <= selectedPass.set.getTime(); t += passStepMs) {
        const d = new Date(t);
        const pv = satellite.propagate(satrec, d);
        if (!pv.position || !pv.velocity) continue;
        const look = computeLookFromStation(selectedPass.station, { positionEci: pv.position, norad: selectedPass.norad }, d);
        const p = skyPointFromLook(look, cx, cy, R);
        if (!p) continue;
        passPts.push(p);
      }
      if (passPts.length > 1) {
        ctx.strokeStyle = colorForNorad(selectedPass.norad);
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(passPts[0].x, passPts[0].y);
        for (let i = 1; i < passPts.length; i += 1) ctx.lineTo(passPts[i].x, passPts[i].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  for (const st of nowStates) {
    const satrec = satrecMap.get(st.norad);
      if (satrec) {
        const pts = [];
        const periodMin = getOrbitPeriodMinutes(st.norad);
        const startMin = -0.1 * periodMin;
        const endMin = 0.15 * periodMin;
        for (let dtMin = startMin; dtMin <= endMin; dtMin += 1) {
          const t = new Date(now.getTime() + dtMin * 60000);
        const pv = satellite.propagate(satrec, t);
        if (!pv.position || !pv.velocity) continue;
        const tempState = { positionEci: pv.position, norad: st.norad };
        const lookTrack = computeLookFromStation(station, tempState, t);
        const p = skyPointFromLook(lookTrack, cx, cy, R);
        if (!p) continue;
        pts.push(p);
      }
      if (pts.length > 1) {
        ctx.strokeStyle = colorForNorad(st.norad);
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    const look = computeLookFromStation(station, st, now);
    const pNow = skyPointFromLook(look, cx, cy, R);
    if (!pNow) continue;
    const color = colorForNorad(st.norad);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pNow.x, pNow.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(`${st.name} ${pNow.elevDeg.toFixed(1)} deg`, pNow.x + 9, pNow.y - 8);
  }
}

function computeDopplerSeries(entry) {
  const satrec = satrecMap.get(entry.norad);
  if (!satrec) return [];

  const station = entry.station;
  const observer = {
    latitude: satellite.degreesToRadians(station.lat),
    longitude: satellite.degreesToRadians(station.lon),
    height: station.altKm
  };
  const carriers = getCarrierHzes();
  const cKmPerSec = 299792.458;
  const stepSec = 10;
  const out = [];

  for (let t = entry.rise.getTime(); t <= entry.set.getTime(); t += stepSec * 1000) {
    const d1 = new Date(t);
    const d2 = new Date(t + 1000);
    const pv1 = satellite.propagate(satrec, d1);
    const pv2 = satellite.propagate(satrec, d2);
    if (!pv1.position || !pv2.position) continue;

    const look1 = satellite.ecfToLookAngles(observer, satellite.eciToEcf(pv1.position, satellite.gstime(d1)));
    const look2 = satellite.ecfToLookAngles(observer, satellite.eciToEcf(pv2.position, satellite.gstime(d2)));
    const rangeRate = look2.rangeSat - look1.rangeSat;
    const shiftDownHz = -(rangeRate / cKmPerSec) * carriers.downlinkHz;
    const shiftUpHz = -(rangeRate / cKmPerSec) * carriers.uplinkHz;

    out.push({
      time: new Date(t),
      minutes: (t - entry.rise.getTime()) / 60000,
      downlinkHz: shiftDownHz,
      uplinkHz: shiftUpHz
    });
  }

  return out;
}

function drawDopplerProfile() {
  const ctx = dopplerCanvasEl.getContext("2d");
  const w = dopplerCanvasEl.width;
  const h = dopplerCanvasEl.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(7,19,31,0.9)";
  ctx.fillRect(0, 0, w, h);

  if (!selectedPassKey) {
    dopplerInfoEl.textContent = "Select a pass from the forecast list.";
    return;
  }

  const entry = passEntries.find((p) => p.key === selectedPassKey);
  if (!entry) {
    dopplerInfoEl.textContent = "Selected pass is no longer available. Select another one.";
    selectedPassKey = "";
    return;
  }

  const series = computeDopplerSeries(entry);
  if (series.length < 2) {
    dopplerInfoEl.textContent = "Unable to compute Doppler profile for this pass.";
    return;
  }

  const margin = { l: 56, r: 18, t: 20, b: 36 };
  const pw = w - margin.l - margin.r;
  const ph = h - margin.t - margin.b;
  const minX = 0;
  const maxX = series[series.length - 1].minutes;
  const allKhz = series.flatMap((p) => [p.downlinkHz / 1000, p.uplinkHz / 1000]);
  const minY = Math.min(...allKhz);
  const maxY = Math.max(...allKhz);
  const padY = Math.max(0.2, (maxY - minY) * 0.15);
  const y0 = minY - padY;
  const y1 = maxY + padY;

  const xToPx = (x) => margin.l + ((x - minX) / Math.max(1e-6, (maxX - minX))) * pw;
  const yToPx = (y) => margin.t + ((y1 - y) / Math.max(1e-6, (y1 - y0))) * ph;

  ctx.strokeStyle = "rgba(133,178,209,0.4)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = y0 + ((y1 - y0) * i) / 4;
    const py = yToPx(y);
    ctx.beginPath(); ctx.moveTo(margin.l, py); ctx.lineTo(w - margin.r, py); ctx.stroke();
    ctx.fillStyle = "#a9cbe3";
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.fillText(`${y.toFixed(1)} kHz`, 6, py + 4);
  }

  const zeroPy = yToPx(0);
  ctx.strokeStyle = "rgba(200,240,220,0.65)";
  ctx.beginPath(); ctx.moveTo(margin.l, zeroPy); ctx.lineTo(w - margin.r, zeroPy); ctx.stroke();

  ctx.strokeStyle = "#7fffd4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((p, i) => {
    const x = xToPx(p.minutes);
    const y = yToPx(p.downlinkHz / 1000);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#f6ba6f";
  ctx.beginPath();
  series.forEach((p, i) => {
    const x = xToPx(p.minutes);
    const y = yToPx(p.uplinkHz / 1000);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const now = getCurrentTime();
  if (now >= entry.rise && now <= entry.set) {
    const currentMin = (now.getTime() - entry.rise.getTime()) / 60000;
    let closest = series[0];
    for (const s of series) {
      if (Math.abs(s.minutes - currentMin) < Math.abs(closest.minutes - currentMin)) closest = s;
    }
    const xNow = xToPx(closest.minutes);
    const yDl = yToPx(closest.downlinkHz / 1000);
    const yUl = yToPx(closest.uplinkHz / 1000);

    ctx.fillStyle = "#7fffd4";
    ctx.beginPath(); ctx.arc(xNow, yDl, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f6ba6f";
    ctx.beginPath(); ctx.arc(xNow, yUl, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(220,240,255,0.65)";
    ctx.beginPath(); ctx.moveTo(xNow, margin.t); ctx.lineTo(xNow, h - margin.b); ctx.stroke();

    ctx.fillStyle = "#d2ecff";
    ctx.fillText(`Current DL: ${(closest.downlinkHz / 1000).toFixed(2)} kHz | Current UL: ${(closest.uplinkHz / 1000).toFixed(2)} kHz`, margin.l, margin.t - 4);
  }

  ctx.fillStyle = "#d2ecff";
  ctx.fillText("Time from AOS (min)", w / 2 - 55, h - 8);
  ctx.fillStyle = "#7fffd4";
  ctx.fillText("Downlink shift", w - 190, 20);
  ctx.fillStyle = "#f6ba6f";
  ctx.fillText("Uplink shift", w - 190, 36);

  dopplerInfoEl.textContent = `${entry.name} | Rise ${formatDateTimeDisplay(entry.rise, false)} | Set ${formatDateTimeDisplay(entry.set, false)} | UL ${Number(lbUplinkFreqEl.value || 2065).toFixed(1)} MHz | DL ${Number(lbDownlinkFreqEl.value || 2265).toFixed(1)} MHz`;
}
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
  for (let t = now.getTime() - trajBackMinutes * 60 * 1000; t <= now.getTime() + trajForwardMinutes * 60 * 1000; t += 60 * 1000) {
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
  passEntries = [];
  if (!selectedNorads.length) { drawDopplerProfile(); return; }
  const now = getCurrentTime();
  const forecastStart = new Date(now.getTime() - PASS_LIST_GRACE_MS);
  const forecastHours = PASS_FORECAST_WINDOW_HOURS + PASS_LIST_GRACE_MS / 3600000;
  const entries = [];
  for (const norad of selectedNorads) {
    const name = catalog.find((c) => c.norad === norad)?.name || norad;
    for (const pass of computePassForecast(norad, primary, forecastStart, forecastHours)) {
      if (pass.set.getTime() < now.getTime() - PASS_LIST_GRACE_MS) continue;
      const key = `${norad}-${pass.rise.toISOString()}`;
      entries.push({ key, name, norad, station: { ...primary }, ...pass });
    }
  }
  entries.sort((a, b) => a.rise - b.rise);
  passEntries = entries;
  if (!entries.length) {
    selectedPassKey = "";
    const li = document.createElement("li");
    li.textContent = `No passes above 5 deg for ${primary.name} in the next 48 hours.`;
    passListEl.appendChild(li);
    drawDopplerProfile();
    return;
  }

  if (!entries.some((p) => p.key === selectedPassKey)) {
    selectedPassKey = entries[0].key;
  }

  for (const pass of entries.slice(0, 80)) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pass-item-btn${pass.key === selectedPassKey ? " active" : ""}`;
    btn.dataset.passKey = pass.key;
    btn.textContent = `${pass.name} | Rise ${formatDateTimeDisplay(pass.rise, false)} | Max ${formatDateTimeDisplay(pass.maxTime, false)} (${pass.maxElevation.toFixed(1)} deg) | Set ${formatDateTimeDisplay(pass.set, false)}`;
    li.appendChild(btn);
    passListEl.appendChild(li);
  }
  updatePassSelectionUI();
  drawDopplerProfile();
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
  utcEl.textContent = formatDateTimeDisplay(now, true);
  const nowStates = [];
  for (const norad of selectedNorads) { const st = propagateSatelliteAt(norad, now); if (st) nowStates.push(st); }
  renderDayNight(now); renderMaskForPrimary(nowStates); renderGroundStationsMap(); renderMarkers(nowStates); renderStats(nowStates); calculateLiveLinks(nowStates, now); drawSkyView(nowStates, now);
  const nowReal = Date.now();
  if (nowReal - lastTrajectoryRenderMs >= TRAJECTORY_REFRESH_MS) { renderTrajectory(now); lastTrajectoryRenderMs = nowReal; }
  if (nowReal - lastPassForecastMs > PASS_RECALC_MS) { renderPassForecast(); lastPassForecastMs = nowReal; }
  if (nowReal - lastDopplerRenderMs > 500) { drawDopplerProfile(); lastDopplerRenderMs = nowReal; }
}

function startAnimationLoop() {
  let previous = performance.now(), acc = 0;
  function frame(ts) { const delta = ts - previous; previous = ts; acc += delta; while (acc >= FRAME_MS) { tick(FRAME_MS); acc -= FRAME_MS; } requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
}

async function bootstrap() {
  try {
    loadGroundStations(); renderGroundStationList(); applySimulationControlsState(); updateTimeControlsUI(); populateCityDatalist(); simStartEl.value = toDateTimeLocalValue(Date.now());
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
gsNameEl.addEventListener("input", tryAutofillGroundStationCity);
[lbUplinkFreqEl, lbUplinkTxPowerEl, lbUplinkTxGainEl, lbUplinkRxGainEl, lbUplinkRxAmpEl, lbUplinkLossesEl, lbDownlinkFreqEl, lbDownlinkTxPowerEl, lbDownlinkTxGainEl, lbDownlinkRxGainEl, lbDownlinkRxAmpEl, lbDownlinkLossesEl].forEach((el) => el.addEventListener("input", () => { tick(0); drawDopplerProfile(); }));
trajBackMinEl.addEventListener("input", () => {
  trajBackMinutes = Math.max(0, Number(trajBackMinEl.value) || 0);
  renderTrajectory(getCurrentTime());
  tick(0);
});
trajForwardMinEl.addEventListener("input", () => {
  trajForwardMinutes = Math.max(0, Number(trajForwardMinEl.value) || 0);
  renderTrajectory(getCurrentTime());
  tick(0);
});
passListEl.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return;
  const btn = target.closest(".pass-item-btn");
  if (!btn || !btn.dataset.passKey) return;
  selectedPassKey = btn.dataset.passKey;
  updatePassSelectionUI();
  drawDopplerProfile();
  tick(0);
});
timeLocalToggleEl.addEventListener("change", () => {
  if (timeLocalToggleEl.checked) timeCustomToggleEl.checked = false;
  updateTimeControlsUI();
  renderPassForecast();
  drawDopplerProfile();
  tick(0);
});
timeCustomToggleEl.addEventListener("change", () => {
  if (timeCustomToggleEl.checked) timeLocalToggleEl.checked = false;
  updateTimeControlsUI();
  renderPassForecast();
  drawDopplerProfile();
  tick(0);
});
timeZoneInputEl.addEventListener("input", () => {
  updateTimeControlsUI();
  renderPassForecast();
  drawDopplerProfile();
  tick(0);
});
window.addEventListener("resize", () => { fitProjection(); renderTrajectory(getCurrentTime()); tick(FRAME_MS); });

bootstrap();
