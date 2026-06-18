// ============================================================
//  Логика карты. Обычно трогать не нужно — данные в projects.js.
// ============================================================

const POI_CATEGORIES = {
  beach:       { label: "Пляжи",     emoji: "🏖️", match: t => t.natural === "beach" },
  school:      { label: "Школы",     emoji: "🏫", match: t => t.amenity === "school" },
  supermarket: { label: "Магазины",  emoji: "🛒", match: t => t.shop === "supermarket" },
  mall:        { label: "ТЦ",        emoji: "🛍️", match: t => t.shop === "mall" },
  hospital:    { label: "Медицина",  emoji: "🏥", match: t => t.amenity === "hospital" || t.amenity === "clinic" },
  restaurant:  { label: "Рестораны", emoji: "🍽️", match: t => t.amenity === "restaurant" }
};
const POI_QUERY = {
  beach: '["natural"="beach"]', school: '["amenity"="school"]',
  supermarket: '["shop"="supermarket"]', mall: '["shop"="mall"]',
  hospital: '["amenity"~"hospital|clinic"]', restaurant: '["amenity"="restaurant"]'
};

const SEARCH_RADIUS = 2000;          // метров
let displayMode = "named";           // "named" (голубой) | "anon" (чёрно-золотой, без названий/ссылок)
let activeRegion = "all";
let presenting = false;              // режим презентации: чистая карта + подписи цен

// ---- Карта ----
const map = L.map("map", { zoomControl: true }).setView(REGIONS.all.center, REGIONS.all.zoom);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);

const projMarkers = {};
let poiLayer = L.layerGroup().addTo(map);

// ---- Геометрия ----
function distance(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtDist = m => m < 1000 ? `~${Math.round(m / 10) * 10} м` : `~${(m / 1000).toFixed(1)} км`;

// ---- Карточка проекта (зависит от режима) ----
function cardHTML(p) {
  const img = p.img
    ? `<img src="${p.img}" onerror="this.outerHTML='<div class=&quot;noimg&quot;>Фото не загрузилось</div>'">`
    : `<div class="noimg">Фото будет позже</div>`;
  // в анонимном режиме — НЕТ названия и ссылки на сайт; заголовок = тип + локация
  const title = displayMode === "anon" ? `${p.type} · ${p.area}` : p.name;
  const areaLine = displayMode === "anon" ? "" : `<div class="area">📍 ${p.area}</div>`;
  const link = displayMode === "anon" ? "" :
    `<a class="link" href="${p.url}" target="_blank" rel="noopener">Открыть проект на tranio.ru ↗</a>`;
  return `
    <div class="card">${img}
      <div class="body">
        <h3>${title}</h3>${areaLine}
        <div class="tags"><span>${p.type}</span><span>${p.stage}</span><span>${p.size}</span></div>
        <div class="price">${p.price}</div>
        <div class="desc">${p.desc}</div>
        ${link}
        <button class="nearby-btn" onclick="loadNearby('${p.id}', this)">Показать, что рядом</button>
        <div class="nearby-list" id="nearby-${p.id}"></div>
      </div>
    </div>`;
}

// ---- Рендер маркеров под текущий режим ----
function renderProjects() {
  Object.values(projMarkers).forEach(m => map.removeLayer(m));
  PROJECTS.forEach(p => {
    const cls = displayMode === "anon" ? "gold" : "blue";
    const glyph = displayMode === "anon" ? "★" : "🏠";
    const icon = L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36],
      html: `<div class="proj-marker ${cls}"><span>${glyph}</span></div>` });
    projMarkers[p.id] = L.marker(p.coords, { icon }).addTo(map).bindPopup(cardHTML(p), { maxWidth: 310 });
  });
  applyFilters();
}

// ---- Фильтры ----
function checkedValues(name) {
  return [...document.querySelectorAll(`input[data-group="${name}"]:checked`)].map(i => i.value);
}
function applyFilters() {
  const types = checkedValues("type");
  const stages = checkedValues("stage");
  const maxEur = +document.getElementById("budget").value;
  PROJECTS.forEach(p => {
    const ok = (activeRegion === "all" || p.region === activeRegion)
      && types.includes(p.typeCat) && stages.includes(p.stageCat) && p.eur <= maxEur;
    const m = projMarkers[p.id];
    if (ok && !map.hasLayer(m)) m.addTo(map);
    if (!ok && map.hasLayer(m)) map.removeLayer(m);
  });
  updateLabels();
}

// ---- Подписи на карте + легенда (только в презентации) ----
function updateLabels() {
  const legend = document.getElementById("legend");
  legend.className = displayMode === "anon" ? "gold" : "";
  let rows = "", n = 0;
  PROJECTS.forEach(p => {
    const m = projMarkers[p.id];
    if (presenting && map.hasLayer(m)) {
      n++;
      const thumb = p.img ? `style="background-image:url('${p.img}')"` : "";
      m.bindTooltip(
        `<div class="ml"><div class="ml-thumb" ${thumb}></div>` +
        `<div class="ml-text"><b>Проект ${n}</b><span>${p.price}</span></div></div>`,
        { permanent: true, direction: "top", offset: [0, -34],
          className: "map-label" + (displayMode === "anon" ? " gold" : "") });
      m.openTooltip();
      const title = displayMode === "anon" ? `${p.type} · ${p.area}` : `${p.name} · ${p.area}`;
      rows += `<div class="lg-row"><b>${n}</b><span>${title}</span><span class="lg-price">${p.price}</span></div>`;
    } else {
      m.unbindTooltip();
    }
  });
  legend.innerHTML = rows ? `<div class="lg-title">Проекты на карте</div>${rows}` : "";
}

// ---- Включение/выключение презентации ----
function togglePresent() {
  presenting = !presenting;
  document.body.classList.toggle("presenting", presenting);
  document.getElementById("present-btn").textContent = presenting ? "✕ Выйти" : "▣ Презентация";
  map.closePopup();
  updateLabels();
}

// ---- Инфраструктура рядом (Overpass / OpenStreetMap) ----
async function loadNearby(projectId, btn) {
  const p = PROJECTS.find(x => x.id === projectId);
  const cats = Object.keys(POI_CATEGORIES).filter(k => document.getElementById("poi-" + k).checked);
  const out = document.getElementById("nearby-" + projectId);
  if (!cats.length) { out.innerHTML = '<div class="nearby-empty">Отметь категории слева.</div>'; return; }

  btn.disabled = true; btn.textContent = "Ищу рядом…";
  poiLayer.clearLayers();
  const [lat, lon] = p.coords;
  const parts = cats.map(k =>
    `node${POI_QUERY[k]}(around:${SEARCH_RADIUS},${lat},${lon});way${POI_QUERY[k]}(around:${SEARCH_RADIUS},${lat},${lon});`).join("");
  const q = `[out:json][timeout:25];(${parts});out center tags;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q) });
    const data = await res.json();
    const grouped = {}; cats.forEach(k => grouped[k] = []);
    data.elements.forEach(el => {
      const t = el.tags || {};
      const cat = cats.find(k => POI_CATEGORIES[k].match(t));
      if (!cat) return;
      const pt = el.type === "node" ? [el.lat, el.lon] : (el.center ? [el.center.lat, el.center.lon] : null);
      if (!pt) return;
      grouped[cat].push({ name: t.name || POI_CATEGORIES[cat].label, pt, dist: distance(p.coords, pt) });
    });
    let html = "";
    cats.forEach(k => {
      const items = grouped[k].sort((a, b) => a.dist - b.dist).slice(0, 6);
      if (!items.length) return;
      html += `<div class="nearby-cat">${POI_CATEGORIES[k].emoji} ${POI_CATEGORIES[k].label}</div>`;
      items.forEach(it => {
        html += `<div class="nearby-item"><span>${it.name}</span><span class="dist">${fmtDist(it.dist)}</span></div>`;
        const icon = L.divIcon({ className: "", iconSize: [24, 24], html: `<div class="poi-marker">${POI_CATEGORIES[k].emoji}</div>` });
        L.marker(it.pt, { icon }).addTo(poiLayer).bindTooltip(`${it.name} · ${fmtDist(it.dist)}`);
      });
    });
    out.innerHTML = html || '<div class="nearby-empty">Поблизости ничего не найдено в выбранных категориях.</div>';
  } catch (e) {
    out.innerHTML = '<div class="nearby-empty">Не удалось загрузить (сервер OSM занят). Попробуй ещё раз.</div>';
  } finally {
    btn.disabled = false; btn.textContent = "Обновить, что рядом";
  }
}

// ---- Режим отображения ----
function setMode(mode) {
  displayMode = mode;
  document.getElementById("topbar").classList.toggle("gold", mode === "anon");
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  map.closePopup();
  renderProjects();
}

// ---- Регион ----
function setRegion(key) {
  activeRegion = key;
  const r = REGIONS[key];
  map.flyTo(r.center, r.zoom, { duration: 0.8 });
  document.querySelectorAll('[data-region]').forEach(b => b.classList.toggle("active", b.dataset.region === key));
  applyFilters();
}

// ---- Сборка панели ----
function uniq(arr) { return [...new Set(arr)]; }
function buildTopbar() {
  // режим
  const modeRow = document.getElementById("mode-row");
  [["named", "С названиями"], ["anon", "Для банков"]].forEach(([m, label]) => {
    const b = document.createElement("button");
    b.textContent = label; b.dataset.mode = m; b.onclick = () => setMode(m);
    if (m === displayMode) b.classList.add("active");
    modeRow.appendChild(b);
  });
  // регион
  const regionRow = document.getElementById("region-row");
  Object.keys(REGIONS).forEach(k => {
    const b = document.createElement("button");
    b.textContent = REGIONS[k].label; b.dataset.region = k; b.onclick = () => setRegion(k);
    if (k === "all") b.classList.add("active");
    regionRow.appendChild(b);
  });
  // тип
  const typeBox = document.getElementById("type-checks");
  uniq(PROJECTS.map(p => p.typeCat)).forEach(v => typeBox.appendChild(makeCheck("type", v)));
  // стадия
  const stageBox = document.getElementById("stage-checks");
  uniq(PROJECTS.map(p => p.stageCat)).forEach(v => stageBox.appendChild(makeCheck("stage", v)));
  // бюджет
  const maxEur = Math.ceil(Math.max(...PROJECTS.map(p => p.eur)) / 100000) * 100000;
  const slider = document.getElementById("budget");
  slider.max = maxEur; slider.value = maxEur; slider.step = 50000;
  const label = document.getElementById("budget-val");
  const upd = () => label.textContent = "до ≈ €" + (+slider.value).toLocaleString("ru-RU");
  slider.oninput = () => { upd(); applyFilters(); };
  upd();
  // POI
  const poi = document.getElementById("poi-checks");
  Object.keys(POI_CATEGORIES).forEach(k => {
    const c = POI_CATEGORIES[k];
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" id="poi-${k}" checked> ${c.emoji} ${c.label}`;
    poi.appendChild(l);
  });
}
function makeCheck(group, value) {
  const l = document.createElement("label");
  l.innerHTML = `<input type="checkbox" data-group="${group}" value="${value}" checked> ${value}`;
  l.querySelector("input").onchange = applyFilters;
  return l;
}

buildTopbar();
renderProjects();
document.getElementById("present-btn").onclick = togglePresent;
