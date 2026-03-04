const PRESET_PATTERN = /^(CENTAURI|PROXIMA)-\d+$/i;
const CATALOG_CACHE_KEY = "celestrakAllCatalog_v2";
const CATALOG_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const PASS_STEP_SEC = 30;
const CATALOG_URL_CANDIDATES = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=all&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
];

const DEFAULT_GROUND_STATIONS = [
  { id: "AZ01-01", name: "Absheron, Azerbaijan", lon: 49.485806, lat: 40.466278, altKm: 0.21 },
  { id: "NZ01-01", name: "Awarua, New Zealand", lon: 168.379194, lat: -46.528111, altKm: 0.016 },
  { id: "CL01-01", name: "Punta Arenas, Chile", lon: -70.847111, lat: -53.041222, altKm: 0.0386 },
  { id: "CL01-02", name: "Punta Arenas, Chile", lon: -70.847111, lat: -53.041222, altKm: 0.0386 },
  { id: "MX01-01", name: "La Paz, Mexico", lon: -110.386167, lat: 24.099333, altKm: 0.0032 },
  { id: "MU01-01", name: "Mon Loisir, Mauritius", lon: 57.687008, lat: -20.139125, altKm: 0.093 },
  { id: "LK01-01", name: "Kandy, Sri Lanka", lon: 80.724861, lat: 7.274222, altKm: 0.462 },
  { id: "IS01-01", name: "Blonduos, Iceland", lon: -20.246083, lat: 65.647361, altKm: 0.053 },
  { id: "PT01-02", name: "Santa Maria, Azores, Portugal", lon: -25.137306, lat: 36.997556, altKm: 0.194 },
  { id: "ZA01-01", name: "Pretoria, South Africa", lon: 28.453778, lat: -25.860333, altKm: 1.392 }
];

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

const statusEl = document.getElementById("status");
const cacheInfoEl = document.getElementById("cacheInfo");
const satSearchEl = document.getElementById("satSearch");
const satCountsEl = document.getElementById("satCounts");
const satChecklistEl = document.getElementById("satChecklist");
const selectedCountEl = document.getElementById("selectedCount");
const gsCountEl = document.getElementById("gsCount");
const presetBtn = document.getElementById("presetBtn");
const clearBtn = document.getElementById("clearBtn");
const refreshBtn = document.getElementById("refreshBtn");
const runPlanBtn = document.getElementById("runPlanBtn");
const startNowBtn = document.getElementById("startNowBtn");
const planStartEl = document.getElementById("planStart");
const cadenceHoursEl = document.getElementById("cadenceHours");
const cadenceModeEl = document.getElementById("cadenceMode");
const forecastDaysEl = document.getElementById("forecastDays");
const minElevationEl = document.getElementById("minElevation");
const planSummaryEl = document.getElementById("planSummary");
const planTableBodyEl = document.getElementById("planTableBody");
const timeLocalToggleEl = document.getElementById("timeLocalToggle");
const timeCustomToggleEl = document.getElementById("timeCustomToggle");
const timeZoneInputEl = document.getElementById("timeZoneInput");
const timeZoneLabelEl = document.getElementById("timeZoneLabel");
const planCanvasEl = document.getElementById("planCanvas");
const planChartInfoEl = document.getElementById("planChartInfo");
const timelineCanvasEl = document.getElementById("timelineCanvas");
const timelineInfoEl = document.getElementById("timelineInfo");
const cityNameInputEl = document.getElementById("cityNameInput");
const cityLatInputEl = document.getElementById("cityLatInput");
const cityLonInputEl = document.getElementById("cityLonInput");
const cityAltInputEl = document.getElementById("cityAltInput");
const addCityGsBtn = document.getElementById("addCityGsBtn");
const plannerGsListEl = document.getElementById("plannerGsList");
const majorCitiesListEl = document.getElementById("majorCitiesList");
const vizSatFilterListEl = document.getElementById("vizSatFilterList");

let catalog = [];
let selectedNorads = [];
let groundStations = DEFAULT_GROUND_STATIONS.map((gs) => ({ ...gs }));
const satrecMap = new Map();
const satColorMap = new Map();
const vizEnabledByNorad = new Map();
let nextColorIndex = 0;
let latestPlanRows = [];
let latestWindowStart = null;
let latestWindowEnd = null;
let latestCadenceHours = 0;
let latestCadenceMode = "individual";
let latestCandidates = [];

function setStatus(msg) { statusEl.textContent = msg; }

function toDateTimeLocalValue(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseTleCatalog(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("1 ")) continue;
    const line1 = lines[i];
    const line2 = lines[i + 1];
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
  } catch {
    return null;
  }
}

function saveCachedCatalog(records) {
  localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), catalog: records }));
}

function setCacheInfo(fetchedAt, label) {
  cacheInfoEl.textContent = `${label}, ${Math.floor((Date.now() - fetchedAt) / 60000)} min old`;
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
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Failed all CelesTrak catalog endpoints: ${lastError?.message || "unknown"}`);
}

function makePresetSelection(records) {
  return records.filter((r) => PRESET_PATTERN.test(r.name)).map((r) => r.norad);
}

function updateSatCounts(filteredCount) {
  satCountsEl.textContent = `${filteredCount} shown / ${catalog.length} total | ${selectedNorads.length} selected`;
  selectedCountEl.textContent = String(selectedNorads.length);
}

function colorForNorad(norad) {
  if (!satColorMap.has(norad)) {
    satColorMap.set(norad, `hsl(${((nextColorIndex * 137.508) % 360).toFixed(1)} 88% 62%)`);
    nextColorIndex += 1;
  }
  return satColorMap.get(norad);
}

function syncVizEnabledNorads() {
  const selectedSet = new Set(selectedNorads);
  for (const key of [...vizEnabledByNorad.keys()]) {
    if (!selectedSet.has(key)) vizEnabledByNorad.delete(key);
  }
  for (const norad of selectedNorads) {
    colorForNorad(norad);
    if (!vizEnabledByNorad.has(norad)) vizEnabledByNorad.set(norad, true);
  }
}

function getVizEnabledNorads() {
  return selectedNorads.filter((norad) => vizEnabledByNorad.get(norad) !== false);
}

function renderVizSatelliteFilter() {
  vizSatFilterListEl.innerHTML = "";
  if (!selectedNorads.length) {
    vizSatFilterListEl.textContent = "Select satellites to enable visualization filters.";
    return;
  }
  const frag = document.createDocumentFragment();
  for (const norad of selectedNorads) {
    const rec = catalog.find((c) => c.norad === norad);
    const name = rec?.name || norad;
    const label = document.createElement("label");
    label.className = "viz-sat-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = vizEnabledByNorad.get(norad) !== false;
    cb.addEventListener("change", () => {
      vizEnabledByNorad.set(norad, cb.checked);
      redrawChartsOnly();
    });
    const sw = document.createElement("span");
    sw.className = "viz-swatch";
    sw.style.background = colorForNorad(norad);
    const txt = document.createElement("span");
    txt.textContent = `${name} (${norad})`;
    label.appendChild(cb);
    label.appendChild(sw);
    label.appendChild(txt);
    frag.appendChild(label);
  }
  vizSatFilterListEl.appendChild(frag);
}

function renderSatelliteChecklist() {
  const q = satSearchEl.value.trim().toLowerCase();
  const selectedSet = new Set(selectedNorads);
  const filtered = catalog.filter((rec) => !q || rec.name.toLowerCase().includes(q) || rec.norad.includes(q));
  satChecklistEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const rec of filtered) {
    const label = document.createElement("label");
    label.className = "sat-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = rec.norad;
    cb.checked = selectedSet.has(rec.norad);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        if (!selectedNorads.includes(rec.norad)) selectedNorads.push(rec.norad);
      } else {
        selectedNorads = selectedNorads.filter((id) => id !== rec.norad);
      }
      buildSatrecsForSelection();
      syncVizEnabledNorads();
      renderVizSatelliteFilter();
      updateSatCounts(filtered.length);
      redrawChartsOnly();
    });
    const t = document.createElement("span");
    t.textContent = `${rec.name} (${rec.norad})`;
    label.appendChild(cb);
    label.appendChild(t);
    frag.appendChild(label);
  }
  satChecklistEl.appendChild(frag);
  updateSatCounts(filtered.length);
}

async function loadCatalog(forceReload = false) {
  const cached = getCachedCatalog();
  const nowMs = Date.now();
  if (!forceReload && cached && nowMs - cached.fetchedAt <= CATALOG_MAX_AGE_MS) {
    catalog = cached.catalog;
    if (!selectedNorads.length) selectedNorads = makePresetSelection(catalog);
    buildSatrecsForSelection();
    syncVizEnabledNorads();
    renderVizSatelliteFilter();
    renderSatelliteChecklist();
    setCacheInfo(cached.fetchedAt, "local cache");
    setStatus(`Loaded ${catalog.length} satellites from cache.`);
    return;
  }

  setStatus("Refreshing full catalog from CelesTrak...");
  try {
    catalog = await fetchCatalogFromCelestrak();
    saveCachedCatalog(catalog);
    if (!selectedNorads.length) selectedNorads = makePresetSelection(catalog);
    else {
      const valid = new Set(catalog.map((r) => r.norad));
      selectedNorads = selectedNorads.filter((id) => valid.has(id));
    }
    buildSatrecsForSelection();
    syncVizEnabledNorads();
    renderVizSatelliteFilter();
    renderSatelliteChecklist();
    setCacheInfo(Date.now(), "CelesTrak fresh fetch");
    setStatus(`Loaded ${catalog.length} satellites from CelesTrak.`);
  } catch (err) {
    if (!cached) throw err;
    catalog = cached.catalog;
    if (!selectedNorads.length) selectedNorads = makePresetSelection(catalog);
    buildSatrecsForSelection();
    syncVizEnabledNorads();
    renderVizSatelliteFilter();
    renderSatelliteChecklist();
    setCacheInfo(cached.fetchedAt, "stale cache fallback");
    setStatus(`Using stale cache due to fetch error: ${err.message}`);
  }
}

function buildSatrecsForSelection() {
  satrecMap.clear();
  for (const norad of selectedNorads) {
    const rec = catalog.find((r) => r.norad === norad);
    if (!rec) continue;
    satrecMap.set(norad, satellite.twoline2satrec(rec.line1, rec.line2));
  }
}

function renderGroundStationList() {
  plannerGsListEl.innerHTML = "";
  gsCountEl.textContent = String(groundStations.length);
  for (const gs of groundStations) {
    const item = document.createElement("div");
    item.className = "gs-item";
    const left = document.createElement("div");
    left.textContent = `${gs.id} | ${gs.name} | ${gs.lat.toFixed(4)}, ${gs.lon.toFixed(4)} | ${gs.altKm.toFixed(3)} km`;
    const actions = document.createElement("div");
    actions.className = "gs-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.disabled = groundStations.length <= 1;
    removeBtn.addEventListener("click", () => {
      groundStations = groundStations.filter((s) => s.id !== gs.id);
      renderGroundStationList();
      if (latestWindowStart && latestWindowEnd) renderPlanResult(latestPlanRows, latestWindowStart, latestWindowEnd, latestCadenceHours, latestCadenceMode);
    });
    actions.appendChild(removeBtn);
    item.appendChild(left);
    item.appendChild(actions);
    plannerGsListEl.appendChild(item);
  }
}

function populateCityDatalist() {
  majorCitiesListEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const city of MAJOR_CITIES) {
    const opt = document.createElement("option");
    opt.value = city.name;
    frag.appendChild(opt);
  }
  majorCitiesListEl.appendChild(frag);
}

function tryAutofillFromCityName() {
  const q = cityNameInputEl.value.trim().toLowerCase();
  if (!q) return;
  const match = MAJOR_CITIES.find((c) => c.name.toLowerCase() === q);
  if (!match) return;
  cityLatInputEl.value = String(match.lat);
  cityLonInputEl.value = String(match.lon);
  cityAltInputEl.value = String(match.altKm);
}

function addGroundStationFromCityForm() {
  tryAutofillFromCityName();
  const name = cityNameInputEl.value.trim();
  const lat = Number(cityLatInputEl.value);
  const lon = Number(cityLonInputEl.value);
  const altKm = cityAltInputEl.value.trim() === "" ? 0 : Number(cityAltInputEl.value);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altKm)) {
    setStatus("Ground station fields invalid.");
    return;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    setStatus("Ground station coordinates out of range.");
    return;
  }
  const id = `CU-${String(Date.now()).slice(-6)}`;
  groundStations.push({ id, name, lat, lon, altKm });
  cityNameInputEl.value = "";
  cityLatInputEl.value = "";
  cityLonInputEl.value = "";
  cityAltInputEl.value = "";
  renderGroundStationList();
  setStatus(`Added ground station ${name}.`);
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
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

function formatDateTime(date, withSeconds = false) {
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

function refineCrossing(t1, e1, t2, e2, minElevationDeg) {
  const f = (minElevationDeg - e1) / (e2 - e1);
  return new Date(t1.getTime() + f * (t2.getTime() - t1.getTime()));
}

function computePassesForStation(satrec, station, startDate, endDate, minElevationDeg) {
  const observer = {
    latitude: satellite.degreesToRadians(station.lat),
    longitude: satellite.degreesToRadians(station.lon),
    height: station.altKm
  };
  const stepMs = PASS_STEP_SEC * 1000;
  let prevDate = null;
  let prevElev = null;
  let inPass = false;
  let cur = null;
  const out = [];

  for (let t = startDate.getTime(); t <= endDate.getTime(); t += stepMs) {
    const d = new Date(t);
    const pv = satellite.propagate(satrec, d);
    if (!pv.position) continue;
    const satEcf = satellite.eciToEcf(pv.position, satellite.gstime(d));
    const look = satellite.ecfToLookAngles(observer, satEcf);
    const elev = satellite.radiansToDegrees(look.elevation);
    if (prevDate !== null && prevElev !== null) {
      if (!inPass && prevElev <= minElevationDeg && elev > minElevationDeg) {
        inPass = true;
        cur = { rise: refineCrossing(prevDate, prevElev, d, elev, minElevationDeg), set: null, maxElevation: elev, maxTime: d };
      }
      if (inPass && cur) {
        if (elev > cur.maxElevation) {
          cur.maxElevation = elev;
          cur.maxTime = d;
        }
        if (prevElev > minElevationDeg && elev <= minElevationDeg) {
          cur.set = refineCrossing(prevDate, prevElev, d, elev, minElevationDeg);
          out.push(cur);
          inPass = false;
          cur = null;
        }
      }
    }
    prevDate = d;
    prevElev = elev;
  }
  if (inPass && cur) {
    cur.set = endDate;
    out.push(cur);
  }
  return out;
}

function passesOverlap(a, b) {
  return a.rise < b.set && b.rise < a.set;
}

function optimizeCadenceSchedule(candidates, startDate, endDate, cadenceHours) {
  const cadenceMs = cadenceHours * 3600 * 1000;
  const slots = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += cadenceMs) slots.push(new Date(t));

  const usedKeys = new Set();
  const selected = [];

  for (const slot of slots) {
    let best = null;
    let bestScore = Infinity;
    for (const cand of candidates) {
      if (usedKeys.has(cand.key)) continue;
      const dt = Math.abs(cand.maxTime.getTime() - slot.getTime());
      if (dt > cadenceMs * 0.9) continue;
      const conflicts = selected.some((s) => !s.missed && s.stationId === cand.stationId && passesOverlap(s, cand));
      if (conflicts) continue;
      const timeScore = dt / cadenceMs;
      const elevScore = 1 - Math.min(cand.maxElevation, 90) / 90;
      const score = 0.78 * timeScore + 0.22 * elevScore;
      if (score < bestScore) {
        best = cand;
        bestScore = score;
      }
    }
    if (best) {
      usedKeys.add(best.key);
      selected.push({ ...best, slot, missed: false });
    } else {
      selected.push({ slot, missed: true });
    }
  }

  return selected;
}

function optimizeIndividualCadenceSchedule(candidates, startDate, endDate, cadenceHours) {
  const cadenceMs = cadenceHours * 3600 * 1000;
  const slots = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += cadenceMs) slots.push(new Date(t));

  const usedKeys = new Set();
  const globallyBooked = [];
  const out = [];

  for (const norad of selectedNorads) {
    const satCandidates = candidates.filter((c) => c.norad === norad);
    for (const slot of slots) {
      let best = null;
      let bestScore = Infinity;
      for (const cand of satCandidates) {
        if (usedKeys.has(cand.key)) continue;
        const dt = Math.abs(cand.maxTime.getTime() - slot.getTime());
        if (dt > cadenceMs * 0.9) continue;
        const conflicts = globallyBooked.some((s) => s.stationId === cand.stationId && passesOverlap(s, cand));
        if (conflicts) continue;
        const timeScore = dt / cadenceMs;
        const elevScore = 1 - Math.min(cand.maxElevation, 90) / 90;
        const score = 0.78 * timeScore + 0.22 * elevScore;
        if (score < bestScore) {
          best = cand;
          bestScore = score;
        }
      }
      if (best) {
        usedKeys.add(best.key);
        globallyBooked.push(best);
        out.push({ ...best, slot, missed: false, targetNorad: norad });
      } else {
        out.push({ slot, missed: true, targetNorad: norad });
      }
    }
  }

  out.sort((a, b) => (a.slot - b.slot) || String(a.targetNorad || "").localeCompare(String(b.targetNorad || "")));
  return out;
}

function optimizeCadenceScheduleByMode(candidates, startDate, endDate, cadenceHours, mode) {
  if (mode === "combined") return optimizeCadenceSchedule(candidates, startDate, endDate, cadenceHours).map((r) => ({ ...r, targetNorad: null }));
  return optimizeIndividualCadenceSchedule(candidates, startDate, endDate, cadenceHours);
}

function buildCandidates(startDate, endDate, minElevationDeg) {
  const out = [];
  for (const norad of selectedNorads) {
    const satrec = satrecMap.get(norad);
    if (!satrec) continue;
    const satName = catalog.find((r) => r.norad === norad)?.name || norad;
    for (const station of groundStations) {
      const passes = computePassesForStation(satrec, station, startDate, endDate, minElevationDeg);
      for (const pass of passes) {
        out.push({
          key: `${norad}-${station.id}-${pass.rise.toISOString()}`,
          norad,
          satName,
          stationId: station.id,
          stationName: station.name,
          rise: pass.rise,
          maxTime: pass.maxTime,
          set: pass.set,
          maxElevation: pass.maxElevation
        });
      }
    }
  }
  out.sort((a, b) => a.maxTime - b.maxTime);
  return out;
}

function drawPlanChart(planRows, startDate, endDate, cadenceHours, cadenceMode) {
  const ctx = planCanvasEl.getContext("2d");
  const w = planCanvasEl.width;
  const h = planCanvasEl.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(7,19,31,0.9)";
  ctx.fillRect(0, 0, w, h);

  if (!planRows.length) {
    planChartInfoEl.textContent = "No slots available in selected window.";
    ctx.fillStyle = "#b6dbf7";
    ctx.font = "14px 'Space Grotesk', sans-serif";
    ctx.fillText("No plan data to visualize.", 16, 28);
    return;
  }

  const enabledSet = new Set(getVizEnabledNorads());
  if (!enabledSet.size) {
    planChartInfoEl.textContent = "Enable at least one satellite in visualizer filters.";
    ctx.fillStyle = "#b6dbf7";
    ctx.font = "14px 'Space Grotesk', sans-serif";
    ctx.fillText("No enabled satellites for chart.", 16, 28);
    return;
  }
  const visibleRows = planRows.filter((r) => (r.missed ? (!r.targetNorad || enabledSet.has(r.targetNorad)) : enabledSet.has(r.norad)));
  const booked = visibleRows.filter((r) => !r.missed).sort((a, b) => a.maxTime - b.maxTime);
  const missed = visibleRows.filter((r) => r.missed);
  const gapSeries = [];
  if (cadenceMode === "individual") {
    for (const norad of selectedNorads) {
      if (!enabledSet.has(norad)) continue;
      const satBooked = visibleRows.filter((r) => !r.missed && r.targetNorad === norad).sort((a, b) => a.maxTime - b.maxTime);
      const pts = [];
      for (let i = 1; i < satBooked.length; i += 1) {
        pts.push({ norad, at: satBooked[i].maxTime, hours: (satBooked[i].maxTime - satBooked[i - 1].maxTime) / 3600000 });
      }
      gapSeries.push(...pts);
    }
  } else {
    for (let i = 1; i < booked.length; i += 1) {
      gapSeries.push({ norad: booked[i].norad, at: booked[i].maxTime, hours: (booked[i].maxTime - booked[i - 1].maxTime) / 3600000 });
    }
  }

  const margin = { l: 60, r: 20, t: 22, b: 52 };
  const pw = w - margin.l - margin.r;
  const ph = h - margin.t - margin.b;
  const t0 = startDate.getTime();
  const t1 = endDate.getTime();
  const yMax = Math.max(cadenceHours * 1.7, 1, ...gapSeries.map((g) => g.hours));
  const xToPx = (t) => margin.l + ((t - t0) / Math.max(1, t1 - t0)) * pw;
  const yToPx = (v) => margin.t + ((yMax - v) / yMax) * ph;

  ctx.strokeStyle = "rgba(133,178,209,0.4)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = (yMax * i) / 5;
    const py = yToPx(y);
    ctx.beginPath(); ctx.moveTo(margin.l, py); ctx.lineTo(w - margin.r, py); ctx.stroke();
    ctx.fillStyle = "#a9cbe3";
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.fillText(`${y.toFixed(1)}h`, 8, py + 4);
  }

  const xTicks = 6;
  for (let i = 0; i <= xTicks; i += 1) {
    const tx = t0 + ((t1 - t0) * i) / xTicks;
    const px = xToPx(tx);
    ctx.strokeStyle = "rgba(133,178,209,0.35)";
    ctx.beginPath(); ctx.moveTo(px, margin.t); ctx.lineTo(px, h - margin.b); ctx.stroke();
    ctx.fillStyle = "#a9cbe3";
    ctx.font = "11px 'Space Grotesk', sans-serif";
    const label = formatDateTime(new Date(tx), false).replace(" UTC", "");
    ctx.fillText(label, Math.max(6, px - 50), h - margin.b + 16);
  }

  const targetPy = yToPx(Math.min(yMax, cadenceHours));
  ctx.strokeStyle = "rgba(34,211,238,0.9)";
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(margin.l, targetPy); ctx.lineTo(w - margin.r, targetPy); ctx.stroke();
  ctx.setLineDash([]);

  if (cadenceMode === "individual") {
    for (const norad of selectedNorads) {
      if (!enabledSet.has(norad)) continue;
      const satPts = gapSeries.filter((g) => g.norad === norad);
      if (!satPts.length) continue;
      const color = colorForNorad(norad);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      satPts.forEach((g, i) => {
        const px = xToPx(g.at.getTime());
        const py = yToPx(g.hours);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.fillStyle = color;
      for (const g of satPts) {
        const px = xToPx(g.at.getTime());
        const py = yToPx(g.hours);
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (gapSeries.length > 0) {
    ctx.strokeStyle = "#7fffd4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    gapSeries.forEach((g, i) => {
      const px = xToPx(g.at.getTime());
      const py = yToPx(g.hours);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    for (const g of gapSeries) {
      const px = xToPx(g.at.getTime());
      const py = yToPx(g.hours);
      ctx.fillStyle = colorForNorad(g.norad || "");
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(255,120,120,0.9)";
  ctx.lineWidth = 1.2;
  for (const m of missed) {
    const px = xToPx(m.slot.getTime());
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px, margin.t); ctx.lineTo(px, h - margin.b); ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = "#d2ecff";
  ctx.font = "12px 'Space Grotesk', sans-serif";
  ctx.fillText("Gap between booked passes (hours)", margin.l, 14);
  ctx.fillStyle = "rgba(34,211,238,0.95)";
  ctx.fillText(`Target cadence: ${cadenceHours.toFixed(2)}h`, w - 210, 14);
  ctx.fillStyle = "rgba(255,120,120,0.95)";
  ctx.fillText(`Missed slots: ${missed.length}`, w - 210, 30);
  planChartInfoEl.textContent = `Mode: ${cadenceMode} | Booked passes: ${booked.length} | Gap points: ${gapSeries.length} | Missed slots: ${missed.length}`;
}

function drawTimelineChart(candidates, planRows, startDate, endDate) {
  const ctx = timelineCanvasEl.getContext("2d");
  const w = timelineCanvasEl.width;
  const h = timelineCanvasEl.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(7,19,31,0.9)";
  ctx.fillRect(0, 0, w, h);

  if (!selectedNorads.length) {
    timelineInfoEl.textContent = "Select at least one satellite to show timeline.";
    return;
  }

  const enabledSet = new Set(getVizEnabledNorads());
  const rows = selectedNorads
    .filter((norad) => enabledSet.has(norad))
    .map((norad) => ({ norad, name: catalog.find((c) => c.norad === norad)?.name || norad }));
  if (!rows.length) {
    timelineInfoEl.textContent = "Enable at least one satellite in visualizer filters.";
    return;
  }
  const t0 = startDate.getTime();
  const t1 = endDate.getTime();
  const margin = { l: 180, r: 20, t: 28, b: 48 };
  const rowH = Math.max(18, Math.floor((h - margin.t - margin.b) / Math.max(1, rows.length)));
  const xToPx = (t) => margin.l + ((t - t0) / Math.max(1, t1 - t0)) * (w - margin.l - margin.r);
  const bookedSet = new Set(
    planRows
      .filter((p) => !p.missed && enabledSet.has(p.norad))
      .map((p) => p.key)
  );

  ctx.strokeStyle = "rgba(133,178,209,0.3)";
  for (let i = 0; i <= 6; i += 1) {
    const tx = t0 + ((t1 - t0) * i) / 6;
    const px = xToPx(tx);
    ctx.beginPath(); ctx.moveTo(px, margin.t); ctx.lineTo(px, h - margin.b); ctx.stroke();
    ctx.fillStyle = "#a9cbe3";
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.fillText(formatDateTime(new Date(tx), false).replace(" UTC", ""), Math.max(4, px - 48), h - margin.b + 16);
  }

  rows.forEach((row, idx) => {
    const y = margin.t + idx * rowH + rowH / 2;
    const rowColor = colorForNorad(row.norad);
    ctx.fillStyle = rowColor;
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.fillText(`${row.name} (${row.norad})`, 8, y + 4);
    ctx.strokeStyle = "rgba(133,178,209,0.25)";
    ctx.beginPath(); ctx.moveTo(margin.l, y); ctx.lineTo(w - margin.r, y); ctx.stroke();

    const satPasses = candidates.filter((c) => c.norad === row.norad);
    for (const p of satPasses) {
      const x1 = xToPx(p.rise.getTime());
      const x2 = xToPx(p.set.getTime());
      if (x2 <= margin.l || x1 >= w - margin.r) continue;
      ctx.lineWidth = bookedSet.has(p.key) ? 6 : 3;
      ctx.strokeStyle = rowColor;
      ctx.globalAlpha = bookedSet.has(p.key) ? 0.95 : 0.35;
      ctx.beginPath();
      ctx.moveTo(Math.max(margin.l, x1), y);
      ctx.lineTo(Math.min(w - margin.r, x2), y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (bookedSet.has(p.key)) {
        ctx.fillStyle = rowColor;
        ctx.font = "10px 'Space Grotesk', sans-serif";
        ctx.fillText(p.stationId, Math.max(margin.l + 1, x1 + 2), y - 6);
      }
    }
  });

  for (const m of planRows.filter((r) => r.missed && (!r.targetNorad || enabledSet.has(r.targetNorad)))) {
    const px = xToPx(m.slot.getTime());
    ctx.strokeStyle = "rgba(255,120,120,0.8)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px, margin.t); ctx.lineTo(px, h - margin.b); ctx.stroke();
  }
  ctx.setLineDash([]);

  timelineInfoEl.textContent = `Pass candidates: ${candidates.length} | Booked: ${bookedSet.size} | Satellites: ${rows.length}`;
}

function redrawChartsOnly() {
  if (!latestWindowStart || !latestWindowEnd) return;
  drawPlanChart(latestPlanRows, latestWindowStart, latestWindowEnd, latestCadenceHours, latestCadenceMode);
  drawTimelineChart(latestCandidates, latestPlanRows, latestWindowStart, latestWindowEnd);
}

function renderPlanResult(planRows, startDate, endDate, cadenceHours, cadenceMode) {
  latestPlanRows = planRows;
  latestWindowStart = startDate;
  latestWindowEnd = endDate;
  latestCadenceHours = cadenceHours;
  latestCadenceMode = cadenceMode;
  planTableBodyEl.innerHTML = "";
  planSummaryEl.innerHTML = "";

  const booked = planRows.filter((r) => !r.missed).sort((a, b) => a.maxTime - b.maxTime);
  const missed = planRows.filter((r) => r.missed);
  let prev = null;
  for (const row of planRows) {
    const tr = document.createElement("tr");
    if (row.missed) tr.className = "planner-missed";
    const tdSlot = document.createElement("td");
    if (row.targetNorad) {
      const targetName = catalog.find((c) => c.norad === row.targetNorad)?.name || row.targetNorad;
      tdSlot.textContent = `${formatDateTime(row.slot)} | Target ${targetName}`;
    } else {
      tdSlot.textContent = formatDateTime(row.slot);
    }
    tr.appendChild(tdSlot);
    if (row.missed) {
      const missCells = ["No suitable pass", "-", "-", "-", "-", "-", "-"];
      for (const txt of missCells) {
        const td = document.createElement("td");
        td.textContent = txt;
        tr.appendChild(td);
      }
    } else {
      const gapH = prev ? (row.maxTime - prev.maxTime) / 3600000 : null;
      const fields = [
        `${row.satName} (${row.norad})`,
        `${row.stationId} | ${row.stationName}`,
        formatDateTime(row.rise),
        formatDateTime(row.maxTime),
        formatDateTime(row.set),
        row.maxElevation.toFixed(1),
        gapH === null ? "-" : gapH.toFixed(2)
      ];
      for (const f of fields) {
        const td = document.createElement("td");
        td.textContent = f;
        tr.appendChild(td);
      }
      prev = row;
    }
    planTableBodyEl.appendChild(tr);
  }

  const stationCounts = new Map();
  for (const b of booked) stationCounts.set(b.stationId, (stationCounts.get(b.stationId) || 0) + 1);
  const topStations = [...stationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, cnt]) => `${id}: ${cnt}`).join(" | ") || "-";
  const achievedCadence = booked.length > 1 ? (booked[booked.length - 1].maxTime - booked[0].maxTime) / 3600000 / (booked.length - 1) : 0;
  const slotCoveragePct = planRows.length ? (booked.length / planRows.length) * 100 : 0;
  const summaryRows = [
    `Window: ${formatDateTime(startDate)} to ${formatDateTime(endDate)}`,
    `Cadence mode: ${cadenceMode}`,
    `Target cadence: ${cadenceHours.toFixed(2)} h | Slots: ${planRows.length}`,
    `Booked passes: ${booked.length} | Missed slots: ${missed.length} | Slot coverage: ${slotCoveragePct.toFixed(1)}%`,
    `Achieved average spacing: ${achievedCadence ? achievedCadence.toFixed(2) : "-"} h`,
    `Most used stations: ${topStations}`
  ];
  for (const txt of summaryRows) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.textContent = txt;
    planSummaryEl.appendChild(card);
  }
  drawPlanChart(planRows, startDate, endDate, cadenceHours, cadenceMode);
  drawTimelineChart(latestCandidates, planRows, startDate, endDate);
}

function getPlanningStartDate() {
  if (planStartEl.value) {
    const d = new Date(planStartEl.value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function runPlanner() {
  if (!selectedNorads.length) {
    setStatus("Select at least one satellite.");
    return;
  }
  const cadenceHours = Math.max(0.25, Number(cadenceHoursEl.value) || 4);
  const cadenceMode = cadenceModeEl.value === "combined" ? "combined" : "individual";
  const forecastDays = Math.max(1, Math.min(14, Number(forecastDaysEl.value) || 5));
  const minElevationDeg = Math.max(0, Math.min(90, Number(minElevationEl.value) || 5));
  const startDate = getPlanningStartDate();
  const endDate = new Date(startDate.getTime() + forecastDays * 24 * 3600 * 1000);

  setStatus("Computing pass candidates...");
  latestCandidates = buildCandidates(startDate, endDate, minElevationDeg);
  setStatus(`Optimizing bookings from ${latestCandidates.length} pass candidates...`);
  const plan = optimizeCadenceScheduleByMode(latestCandidates, startDate, endDate, cadenceHours, cadenceMode);
  renderPlanResult(plan, startDate, endDate, cadenceHours, cadenceMode);
  const bookedCount = plan.filter((p) => !p.missed).length;
  if (!bookedCount) setStatus("No suitable passes found for this window and constraints.");
  else setStatus(`Planner complete: ${bookedCount} bookings suggested.`);
}

async function bootstrap() {
  populateCityDatalist();
  renderGroundStationList();
  planStartEl.value = toDateTimeLocalValue(Date.now());
  updateTimeControlsUI();
  await loadCatalog(false);
  syncVizEnabledNorads();
  renderVizSatelliteFilter();
  renderSatelliteChecklist();
}

satSearchEl.addEventListener("input", renderSatelliteChecklist);
presetBtn.addEventListener("click", () => {
  selectedNorads = makePresetSelection(catalog);
  buildSatrecsForSelection();
  syncVizEnabledNorads();
  renderVizSatelliteFilter();
  renderSatelliteChecklist();
  redrawChartsOnly();
});
clearBtn.addEventListener("click", () => {
  selectedNorads = [];
  buildSatrecsForSelection();
  syncVizEnabledNorads();
  renderVizSatelliteFilter();
  renderSatelliteChecklist();
  redrawChartsOnly();
});
refreshBtn.addEventListener("click", async () => {
  try {
    await loadCatalog(true);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});
runPlanBtn.addEventListener("click", runPlanner);
startNowBtn.addEventListener("click", () => { planStartEl.value = toDateTimeLocalValue(Date.now()); });
cityNameInputEl.addEventListener("input", tryAutofillFromCityName);
addCityGsBtn.addEventListener("click", addGroundStationFromCityForm);
timeLocalToggleEl.addEventListener("change", () => {
  if (timeLocalToggleEl.checked) timeCustomToggleEl.checked = false;
  updateTimeControlsUI();
  if (latestWindowStart && latestWindowEnd) renderPlanResult(latestPlanRows, latestWindowStart, latestWindowEnd, latestCadenceHours, latestCadenceMode);
});
timeCustomToggleEl.addEventListener("change", () => {
  if (timeCustomToggleEl.checked) timeLocalToggleEl.checked = false;
  updateTimeControlsUI();
  if (latestWindowStart && latestWindowEnd) renderPlanResult(latestPlanRows, latestWindowStart, latestWindowEnd, latestCadenceHours, latestCadenceMode);
});
timeZoneInputEl.addEventListener("input", () => {
  updateTimeControlsUI();
  if (latestWindowStart && latestWindowEnd) renderPlanResult(latestPlanRows, latestWindowStart, latestWindowEnd, latestCadenceHours, latestCadenceMode);
});

bootstrap().catch((err) => setStatus(`Error: ${err.message}`));
