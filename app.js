// ============================================================
//  Логика карты. Данные берутся из Google-таблицы (см. config.js).
//  Обычно этот файл трогать не нужно.
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

const SEARCH_RADIUS = 2000;
let PROJECTS = [];
let displayMode = "named";
let activeCountry = "all";
let activeRegion = "all";
let presenting = false;

// ---- Карта ----
const map = L.map("map", { zoomControl: true }).setView([25, 65], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
const projMarkers = {};
let poiLayer = L.layerGroup().addTo(map);

// ============================================================
//  ЗАГРУЗКА ДАННЫХ ИЗ ТАБЛИЦЫ
// ============================================================
async function loadData() {
  try {
    const res = await fetch(SHEET_CSV_URL + "&_=" + Date.now());  // обход кэша браузера
    const text = await res.text();
    PROJECTS = rowsToProjects(parseCSV(text));
    if (!PROJECTS.length) throw new Error("Таблица пустая");
    document.getElementById("loading").style.display = "none";
    buildTopbar();
    renderProjects();
    fitTo(PROJECTS);
  } catch (e) {
    document.getElementById("loading").innerHTML =
      "Не удалось загрузить таблицу.<br>Проверь, что она опубликована как CSV.<br><small>" + e.message + "</small>";
  }
}

// Разбор CSV с учётом кавычек, запятых и переносов внутри ячеек
function parseCSV(text) {
  const rows = []; let row = [], field = "", inQ = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++;
    } else {
      if (c === '"') { inQ = true; i++; }
      else if (c === ",") { row.push(field); field = ""; i++; }
      else if (c === "\r") { i++; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; }
      else { field += c; i++; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToProjects(rows) {
  if (!rows.length) return [];
  const H = {}; rows[0].forEach((h, i) => H[h.trim()] = i);
  const get = (r, name) => (H[name] != null ? (r[H[name]] || "").trim() : "");
  const out = [];
  rows.slice(1).forEach((r, idx) => {
    const country = get(r, "Страна");
    const coords = parseCoords(get(r, "Координаты"));
    if (!country || !coords) return;               // пустые/битые строки пропускаем
    const type = get(r, "Тип");
    const stage = get(r, "Стадия");
    const srok = get(r, "Срок сдачи");
    const photos = get(r, "Фото").split("|").map(s => s.trim()).filter(Boolean);
    const price = get(r, "Цена");
    out.push({
      id: "p" + idx, country, region: get(r, "Регион"), coords,
      name: get(r, "Название") || "Без названия",
      area: get(r, "Город/Локация"),
      type, typeCat: deriveType(type),
      stageLabel: stageLabel(deriveStage(stage), srok), stageCat: deriveStage(stage),
      price, eur: priceToEur(price),
      size: get(r, "Площадь и спальни"),
      desc: get(r, "Описание"),
      photos, img: photos[0] || null,
      url: get(r, "Ссылка")
    });
  });
  return out;
}

function parseCoords(s) {
  const m = s.split(",").map(x => parseFloat(x.trim()));
  return (m.length === 2 && !isNaN(m[0]) && !isNaN(m[1])) ? [m[0], m[1]] : null;
}
function priceToEur(s) {
  if (!s) return 0;
  const num = parseInt(s.replace(/[^\d]/g, ""), 10) || 0;
  const cur = Object.keys(FX_TO_EUR).find(c => s.includes(c)) || "€";
  return Math.round(num * FX_TO_EUR[cur]);
}
function deriveType(t) {
  const l = t.toLowerCase();
  if (l.includes("кондо")) return "Кондо";
  if (l.includes("вилл")) return "Виллы";
  if (l.includes("апарт")) return "Апартаменты";
  return t || "Другое";
}
function deriveStage(s) {
  const l = s.toLowerCase();
  if (l.includes("строит")) return "Строится";
  if (l.includes("готов")) return "Готов";
  if (l.includes("запрос")) return "По запросу";
  return s || "—";
}
function stageLabel(cat, srok) {
  if (cat === "Строится") return srok ? `Строится · сдача ${srok}` : "Строится";
  if (cat === "Готов") return srok ? `Готов · ${srok}` : "Готов";
  return cat;
}

// ============================================================
//  ОТОБРАЖЕНИЕ
// ============================================================
const fmtDist = m => m < 1000 ? `~${Math.round(m / 10) * 10} м` : `~${(m / 1000).toFixed(1)} км`;
function distance(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function galleryHTML(p) {
  if (!p.photos.length) return `<div class="noimg">Фото будет позже</div>`;
  const multi = p.photos.length > 1;
  return `<div class="gallery" id="gal-${p.id}">
      <img src="${p.photos[0]}" data-idx="0" onerror="this.classList.add('broken')">
      ${multi ? `<button class="gal-nav prev" onclick="galStep('${p.id}',-1)">‹</button>
      <button class="gal-nav next" onclick="galStep('${p.id}',1)">›</button>
      <div class="gal-count"><span id="gal-c-${p.id}">1</span>/${p.photos.length}</div>` : ""}
    </div>`;
}
function galStep(id, dir) {
  const p = PROJECTS.find(x => x.id === id);
  const img = document.querySelector(`#gal-${id} img`);
  const idx = (+img.dataset.idx + dir + p.photos.length) % p.photos.length;
  img.src = p.photos[idx]; img.dataset.idx = idx; img.classList.remove("broken");
  document.getElementById("gal-c-" + id).textContent = idx + 1;
}

function cardHTML(p) {
  const title = displayMode === "anon" ? `${p.type} · ${p.area}` : p.name;
  const areaLine = displayMode === "anon" ? "" : `<div class="area">📍 ${p.area}</div>`;
  const link = (displayMode === "anon" || !p.url) ? "" :
    `<a class="link" href="${p.url}" target="_blank" rel="noopener">Открыть проект на tranio.ru ↗</a>`;
  return `<div class="card">${galleryHTML(p)}<div class="body">
      <h3>${title}</h3>${areaLine}
      <div class="tags"><span>${p.type}</span><span>${p.stageLabel}</span><span>${p.size}</span></div>
      <div class="price">${p.price}</div>
      <div class="desc">${p.desc}</div>${link}
      <button class="nearby-btn" onclick="loadNearby('${p.id}', this)">Показать, что рядом</button>
      <div class="nearby-list" id="nearby-${p.id}"></div></div></div>`;
}

function renderProjects() {
  Object.values(projMarkers).forEach(m => map.removeLayer(m));
  for (const k in projMarkers) delete projMarkers[k];
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
    const ok = (activeCountry === "all" || p.country === activeCountry)
      && (activeRegion === "all" || p.region === activeRegion)
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
      m.bindTooltip(`<div class="ml"><div class="ml-thumb" ${thumb}></div>` +
        `<div class="ml-text"><b>Проект ${n}</b><span>${p.price}</span></div></div>`,
        { permanent: true, direction: "top", offset: [0, -34], className: "map-label" + (displayMode === "anon" ? " gold" : "") });
      m.openTooltip();
      const title = displayMode === "anon" ? `${p.type} · ${p.area}` : `${p.name} · ${p.area}`;
      rows += `<div class="lg-row"><b>${n}</b><span>${title}</span><span class="lg-price">${p.price}</span></div>`;
    } else {
      m.unbindTooltip();
    }
  });
  legend.innerHTML = rows ? `<div class="lg-title">Проекты на карте</div>${rows}` : "";
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

// ---- Режим / страна / презентация ----
function setMode(mode) {
  displayMode = mode;
  document.getElementById("topbar").classList.toggle("gold", mode === "anon");
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  map.closePopup();
  renderProjects();
}
function setCountry(name) {
  activeCountry = name; activeRegion = "all";
  document.querySelectorAll('[data-country]').forEach(b => b.classList.toggle("active", b.dataset.country === name));
  buildRegionRow(name);
  applyFilters();
  fitTo(name === "all" ? PROJECTS : PROJECTS.filter(p => p.country === name));
}
// Второй ряд кнопок — регионы выбранной страны (появляется, если их ≥2)
function buildRegionRow(country) {
  const section = document.getElementById("region-section");
  const row = document.getElementById("region-row");
  row.innerHTML = "";
  const regions = country === "all" ? []
    : uniq(PROJECTS.filter(p => p.country === country && p.region).map(p => p.region));
  if (regions.length < 2) { section.style.display = "none"; return; }
  section.style.display = "block";
  const all = document.createElement("button");
  all.textContent = "Все"; all.dataset.region = "all"; all.onclick = () => setRegion("all");
  all.classList.add("active"); row.appendChild(all);
  regions.forEach(rg => {
    const b = document.createElement("button");
    b.textContent = rg; b.dataset.region = rg; b.onclick = () => setRegion(rg);
    row.appendChild(b);
  });
}
function setRegion(name) {
  activeRegion = name;
  document.querySelectorAll('[data-region]').forEach(b => b.classList.toggle("active", b.dataset.region === name));
  applyFilters();
  fitTo(PROJECTS.filter(p => p.country === activeCountry && (name === "all" || p.region === name)));
}
function fitTo(list) {
  if (!list.length) return;
  map.flyToBounds(L.latLngBounds(list.map(p => p.coords)), { padding: [70, 70], maxZoom: 14, duration: 0.8 });
}
function togglePresent() {
  presenting = !presenting;
  document.body.classList.toggle("presenting", presenting);
  document.getElementById("present-btn").textContent = presenting ? "✕ Выйти" : "▣ Презентация";
  map.closePopup();
  updateLabels();
}

// ---- Сборка панели (после загрузки данных) ----
function uniq(arr) { return [...new Set(arr)]; }
function buildTopbar() {
  const modeRow = document.getElementById("mode-row");
  [["named", "С названиями"], ["anon", "Для банков"]].forEach(([m, label]) => {
    const b = document.createElement("button");
    b.textContent = label; b.dataset.mode = m; b.onclick = () => setMode(m);
    if (m === displayMode) b.classList.add("active");
    modeRow.appendChild(b);
  });
  const countryRow = document.getElementById("country-row");
  const allBtn = document.createElement("button");
  allBtn.textContent = "Все"; allBtn.dataset.country = "all"; allBtn.onclick = () => setCountry("all");
  allBtn.classList.add("active"); countryRow.appendChild(allBtn);
  uniq(PROJECTS.map(p => p.country)).forEach(c => {
    const b = document.createElement("button");
    b.textContent = c; b.dataset.country = c; b.onclick = () => setCountry(c);
    countryRow.appendChild(b);
  });
  uniq(PROJECTS.map(p => p.typeCat)).forEach(v => document.getElementById("type-checks").appendChild(makeCheck("type", v)));
  uniq(PROJECTS.map(p => p.stageCat)).forEach(v => document.getElementById("stage-checks").appendChild(makeCheck("stage", v)));
  const maxEur = Math.ceil(Math.max(...PROJECTS.map(p => p.eur), 100000) / 100000) * 100000;
  const slider = document.getElementById("budget");
  slider.max = maxEur; slider.value = maxEur; slider.step = 50000;
  const label = document.getElementById("budget-val");
  const upd = () => label.textContent = "до ≈ €" + (+slider.value).toLocaleString("ru-RU");
  slider.oninput = () => { upd(); applyFilters(); };
  upd();
  Object.keys(POI_CATEGORIES).forEach(k => {
    const c = POI_CATEGORIES[k];
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" id="poi-${k}" checked> ${c.emoji} ${c.label}`;
    document.getElementById("poi-checks").appendChild(l);
  });
  document.getElementById("present-btn").onclick = togglePresent;
}
function makeCheck(group, value) {
  const l = document.createElement("label");
  l.innerHTML = `<input type="checkbox" data-group="${group}" value="${value}" checked> ${value}`;
  l.querySelector("input").onchange = applyFilters;
  return l;
}

loadData();
