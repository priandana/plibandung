// =====================
// Warehouse Spreadsheet Hub (Static Pro)
// Features: Dark Mode, Search by title+tags, Tag chips, Category icons, Admin (no backend) via LocalStorage
// =====================

// ===== Default Data (edit this if you want to "ship" a shared list in repo) =====
const DEFAULT_SHEETS = [
  // UMUM
  {
    id: "u-1",
    title: "Dashboard Gudang Harian",
    description: "Ringkasan inbound/outbound + KPI.",
    category: "Umum",
    url: "https://docs.google.com/spreadsheets/d/XXXX",
    tags: ["dashboard", "harian"],
    updatedAt: "2026-01-02"
  },
  {
    id: "u-2",
    title: "Roster & Shift",
    description: "Jadwal shift + PIC.",
    category: "Umum",
    url: "https://docs.google.com/spreadsheets/d/YYYY",
    tags: ["shift", "pic"]
  },

  // FINISHGOOD
  {
    id: "fg-1",
    title: "Stock FG - Master",
    description: "Master stok Finishgood per lokasi.",
    category: "Finishgood",
    url: "https://docs.google.com/spreadsheets/d/AAAA",
    tags: ["stock", "master"]
  },

  // MATERIAL
  {
    id: "m-1",
    title: "Material Inbound Tracker",
    description: "Tracking kedatangan material + status QC.",
    category: "Material",
    url: "https://docs.google.com/spreadsheets/d/BBBB",
    tags: ["inbound", "qc"]
  }
];

const STORAGE_KEY = "warehouse_sheets_v1";
const THEME_KEY = "warehouse_theme_v1";

const PIN_UNLOCK_KEY = "warehouse_admin_unlock_v1"; // stores { until:number } in ms
const PIN_REMEMBER_KEY = "warehouse_admin_remember_v1"; // stores { until:number } in ms

// === Admin PIN (ubah ini) ===
const ADMIN_PIN = "1309"; // <-- ganti sesuai kebutuhan (contoh: 1234)
const UNLOCK_MINUTES = 30;
const REMEMBER_DAYS = 30;


// ===== State =====
let activeCategory = "Umum";
let query = "";

// ===== Elements =====
const grid = document.getElementById("grid");
const skeleton = document.getElementById("skeleton");
const empty = document.getElementById("empty");
const metaCount = document.getElementById("metaCount");
const searchInput = document.getElementById("searchInput");
const overlay = document.getElementById("overlay");
const topbar = document.getElementById("topbar");
const tagRow = document.getElementById("tagRow");

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeText = document.getElementById("themeText");

const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminList = document.getElementById("adminList");

const pinModal = document.getElementById("pinModal");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinRemember = document.getElementById("pinRemember");
const pinHelp = document.getElementById("pinHelp");

const sheetForm = document.getElementById("sheetForm");
const sheetId = document.getElementById("sheetId");
const sheetCategory = document.getElementById("sheetCategory");
const sheetTitle = document.getElementById("sheetTitle");
const sheetDesc = document.getElementById("sheetDesc");
const sheetUrl = document.getElementById("sheetUrl");
const sheetTags = document.getElementById("sheetTags");

const resetFormBtn = document.getElementById("resetFormBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const resetAllBtn = document.getElementById("resetAllBtn");

const toast = document.getElementById("toast");

// ===== Utils =====
function uid(prefix="s"){
  return `${prefix}-${Math.random().toString(16).slice(2,10)}-${Date.now().toString(16).slice(2)}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function normalizeTags(input){
  if (!input) return [];
  return input
    .split(",")
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .map(t => t.replace(/^#/, "")) // allow typing #tag
    .filter((t, i, arr) => arr.indexOf(t) === i); // unique
}

function parseQuery(raw){
  const q = (raw || "").trim();
  const lower = q.toLowerCase();
  // Allow hashtag search: "#qc inbound"
  const tokens = lower.split(/\s+/).filter(Boolean);
  const tagTokens = tokens
    .filter(t => t.startsWith("#") && t.length > 1)
    .map(t => t.replace(/^#/, ""));
  const textTokens = tokens.filter(t => !t.startsWith("#"));
  return { q, lower, tagTokens, textTokens };
}

function startTopbar() {
  topbar.style.opacity = "1";
  topbar.style.width = "12%";
  setTimeout(() => (topbar.style.width = "55%"), 120);
  setTimeout(() => (topbar.style.width = "82%"), 260);
}
function doneTopbar() {
  topbar.style.width = "100%";
  setTimeout(() => {
    topbar.style.opacity = "0";
    topbar.style.width = "0%";
  }, 250);
}

function showOverlay(ms = 700) {
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }, ms);
}

function showSkeleton(on) {
  if (on) {
    skeleton.classList.remove("hidden");
    grid.classList.add("hidden");
    empty.classList.add("hidden");
  } else {
    skeleton.classList.add("hidden");
    grid.classList.remove("hidden");
  }
}

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  toast.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden", "true");
  }, 1600);
}

function loadSheets(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(DEFAULT_SHEETS);
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) return structuredClone(DEFAULT_SHEETS);
    // basic sanitize
    return parsed.map(s => ({
      id: s.id || uid("s"),
      title: String(s.title || "Untitled"),
      description: s.description ? String(s.description) : "",
      category: ["Umum","Finishgood","Material"].includes(s.category) ? s.category : "Umum",
      url: String(s.url || ""),
      tags: Array.isArray(s.tags) ? s.tags.map(t => String(t).toLowerCase()) : normalizeTags(String(s.tags||"")),
      updatedAt: s.updatedAt ? String(s.updatedAt) : ""
    }));
  }catch{
    return structuredClone(DEFAULT_SHEETS);
  }
}
function saveSheets(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

let SHEETS = loadSheets();

// ===== Filtering / Rendering =====
function filteredSheets() {
  const { tagTokens, textTokens, lower } = parseQuery(query);

  return SHEETS.filter((s) => {
    if (s.category !== activeCategory) return false;

    const tags = (s.tags || []).map(t => String(t).toLowerCase());
    const hay = [
      s.title,
      s.description || "",
      tags.join(" "),
      s.updatedAt || ""
    ].join(" ").toLowerCase();

    // tag tokens must all be included
    if (tagTokens.length){
      for(const t of tagTokens){
        if(!tags.includes(t)) return false;
      }
    }

    // remaining text tokens must appear somewhere
    if (textTokens.length){
      for(const t of textTokens){
        if(!hay.includes(t)) return false;
      }
      return true;
    }

    // if no text tokens, but we have tags -> already checked
    // if no tokens at all -> match all
    if (!lower.trim()) return true;
    return true;
  });
}

function iconForCategory(cat){
  if(cat === "Finishgood") return "📦";
  if(cat === "Material") return "🧱";
  return "🏷️";
}

function badgeTag(t){
  const tt = String(t).toLowerCase();
  return `<span class="badge tag" data-tag="${esc(tt)}">#${esc(tt)}</span>`;
}

function cardTemplate(item) {
  const tags = (item.tags || []).map(badgeTag).join("");

  const updated = item.updatedAt
    ? `<span class="badge">Update: ${esc(item.updatedAt)}</span>`
    : "";

  const catIc = iconForCategory(item.category);

  return `
  <article class="card">
    <div class="card-body">
      <div class="card-top">
        <div>
          <h3 class="card-title">${esc(catIc)} ${esc(item.title)}</h3>
          ${item.description ? `<p class="card-desc">${esc(item.description)}</p>` : ""}
        </div>
        <button class="btn" data-open="${esc(item.url)}" type="button">
          Buka <span aria-hidden="true">↗</span>
        </button>
      </div>

      ${(updated || tags) ? `<div class="badges">${updated}${tags}</div>` : ""}
    </div>
  </article>`;
}

function render() {
  const items = filteredSheets();
  metaCount.textContent = `Menampilkan ${items.length} link di kategori ${activeCategory}`;

  if (items.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = items.map(cardTemplate).join("");
}

function buildSkeleton() {
  skeleton.innerHTML = Array.from({ length: 6 })
    .map(() => `<div class="skeleton"></div>`)
    .join("");
}

function buildTagRow(){
  // show top tags for active category
  const counts = new Map();
  SHEETS.filter(s => s.category === activeCategory).forEach(s => {
    (s.tags || []).forEach(t => {
      const key = String(t).toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  const sorted = [...counts.entries()].sort((a,b)=> b[1]-a[1]).slice(0, 10);
  if(!sorted.length){
    tagRow.innerHTML = "";
    return;
  }
  tagRow.innerHTML = `
    <span class="muted">Tag:</span>
    ${sorted.map(([t,c]) => `<button class="tagchip" type="button" data-tagpick="${esc(t)}">#${esc(t)} <span class="muted">(${c})</span></button>`).join("")}
  `;
}

// ===== Tabs / Search / Clicks =====
document.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) {
    const next = tab.getAttribute("data-cat");
    if (!next || next === activeCategory) return;

    document.querySelectorAll(".tab").forEach((b) => {
      const isActive = b.getAttribute("data-cat") === next;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    activeCategory = next;
    query = "";
    searchInput.value = "";

    startTopbar();
    showSkeleton(true);
    setTimeout(() => {
      showSkeleton(false);
      buildTagRow();
      render();
      doneTopbar();
    }, 320);
    return;
  }

  const openBtn = e.target.closest("[data-open]");
  if (openBtn) {
    const url = openBtn.getAttribute("data-open");
    if (!url) return;
    showOverlay(700);
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const tagBadge = e.target.closest("[data-tag]");
  if(tagBadge){
    const t = tagBadge.getAttribute("data-tag");
    if(!t) return;
    searchInput.value = `#${t}`;
    query = searchInput.value;
    render();
    return;
  }

  const tagPick = e.target.closest("[data-tagpick]");
  if(tagPick){
    const t = tagPick.getAttribute("data-tagpick");
    if(!t) return;
    searchInput.value = `#${t}`;
    query = searchInput.value;
    render();
    return;
  }

  const close = e.target.closest("[data-close]");
  if(close){
    closeAdmin();
    return;
  }

  const edit = e.target.closest("[data-edit]");
  if(edit){
    const id = edit.getAttribute("data-edit");
    if(!id) return;
    const item = SHEETS.find(s => s.id === id);
    if(!item) return;
    fillForm(item);
    return;
  }

  const del = e.target.closest("[data-del]");
  if(del){
    const id = del.getAttribute("data-del");
    if(!id) return;
    if(!confirm("Hapus link ini?")) return;
    SHEETS = SHEETS.filter(s => s.id !== id);
    saveSheets(SHEETS);
    renderAll();
    showToast("Link dihapus");
    return;
  }
});

searchInput.addEventListener("input", (e) => {
  query = e.target.value || "";
  render();
});

// ===== Dark mode =====
function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  themeIcon.textContent = dark ? "☀️" : "🌙";
  themeText.textContent = dark ? "Light" : "Dark";
}
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved ? saved === "dark" : prefersDark);
})();
themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(!isDark);
});

// ===== Admin Modal =====

function now(){ return Date.now(); }

function getUnlockUntil(){
  try{
    const raw = localStorage.getItem(PIN_UNLOCK_KEY);
    if(!raw) return 0;
    const obj = JSON.parse(raw);
    return Number(obj.until || 0);
  }catch{ return 0; }
}
function getRememberUntil(){
  try{
    const raw = localStorage.getItem(PIN_REMEMBER_KEY);
    if(!raw) return 0;
    const obj = JSON.parse(raw);
    return Number(obj.until || 0);
  }catch{ return 0; }
}

function isAdminUnlocked(){
  const t = now();
  const until = Math.max(getUnlockUntil(), getRememberUntil());
  return until && until > t;
}

function setUnlock(minutes){
  const until = now() + minutes*60*1000;
  localStorage.setItem(PIN_UNLOCK_KEY, JSON.stringify({ until }));
}

function setRemember(days){
  const until = now() + days*24*60*60*1000;
  localStorage.setItem(PIN_REMEMBER_KEY, JSON.stringify({ until }));
}

function openPin(){
  pinModal.classList.add("show");
  pinModal.setAttribute("aria-hidden","false");
  pinInput.value = "";
  pinRemember.checked = false;
  pinHelp.textContent = "Masukkan PIN untuk membuka Admin.";
  setTimeout(()=> pinInput.focus(), 50);
}
function closePin(){
  pinModal.classList.remove("show");
  pinModal.setAttribute("aria-hidden","true");
}

function verifyPin(input){
  return String(input || "").trim() === ADMIN_PIN;
}


function openAdmin(){
  adminModal.classList.add("show");
  adminModal.setAttribute("aria-hidden", "false");
  buildAdminList();
  // Focus first field
  setTimeout(()=> sheetTitle.focus(), 50);
}
function closeAdmin(){
  adminModal.classList.remove("show");
  adminModal.setAttribute("aria-hidden", "true");
}
adminBtn.addEventListener("click", () => {
  if(isAdminUnlocked()) return openAdmin();
  openPin();
});

pinSubmit.addEventListener("click", () => {
  const ok = verifyPin(pinInput.value);
  if(!ok){
    pinHelp.textContent = "PIN salah. Coba lagi.";
    pinInput.focus();
    pinInput.select();
    return;
  }
  // unlock for session
  setUnlock(UNLOCK_MINUTES);
  if(pinRemember.checked){
    setRemember(REMEMBER_DAYS);
  }
  closePin();
  openAdmin();
  showToast("Admin terbuka");
});

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape"){
    if(adminModal.classList.contains("show")) closeAdmin();
    if(pinModal.classList.contains("show")) closePin();
  }
  if(e.key === "Enter" && pinModal.classList.contains("show")){
    pinSubmit.click();
  }
});

function fillForm(item){
  sheetId.value = item.id;
  sheetCategory.value = item.category;
  sheetTitle.value = item.title || "";
  sheetDesc.value = item.description || "";
  sheetUrl.value = item.url || "";
  sheetTags.value = (item.tags || []).join(", ");
  showToast("Mode edit aktif");
}

function resetForm(){
  sheetId.value = "";
  sheetCategory.value = activeCategory;
  sheetTitle.value = "";
  sheetDesc.value = "";
  sheetUrl.value = "";
  sheetTags.value = "";
}
resetFormBtn.addEventListener("click", resetForm);

function buildAdminList(){
  // show grouped by category
  const groups = ["Umum","Finishgood","Material"].map(cat => {
    const items = SHEETS.filter(s => s.category === cat);
    if(!items.length) return "";
    return `
      <div class="muted" style="margin-top:10px;font-weight:900">${esc(iconForCategory(cat))} ${esc(cat)} (${items.length})</div>
      ${items.map(item => `
        <div class="admin-item">
          <div class="admin-item-top">
            <div style="min-width:0">
              <p class="admin-item-title" style="margin:0">${esc(item.title)}</p>
              <div class="admin-item-sub">${esc(item.url)}</div>
              ${(item.tags && item.tags.length) ? `<div class="badges" style="margin-top:8px">${item.tags.map(badgeTag).join("")}</div>` : ""}
            </div>
            <div class="admin-actions">
              <button class="smallbtn" type="button" data-edit="${esc(item.id)}">Edit</button>
              <button class="smallbtn danger" type="button" data-del="${esc(item.id)}">Hapus</button>
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }).join("");

  adminList.innerHTML = groups || `<div class="muted">Belum ada link. Tambahkan dari form kiri.</div>`;
}

function renderAll(){
  buildTagRow();
  render();
  if(adminModal.classList.contains("show")) buildAdminList();
}

sheetForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = (sheetId.value || "").trim();
  const cat = sheetCategory.value;
  const title = (sheetTitle.value || "").trim();
  const desc = (sheetDesc.value || "").trim();
  const url = (sheetUrl.value || "").trim();
  const tags = normalizeTags(sheetTags.value || "");
  const updatedAt = new Date().toISOString().slice(0,10);

  if(!title){
    alert("Judul wajib diisi.");
    sheetTitle.focus();
    return;
  }
  if(!url || !/^https?:\/\//i.test(url)){
    alert("URL wajib diisi (harus diawali http/https).");
    sheetUrl.focus();
    return;
  }

  if(id){
    const idx = SHEETS.findIndex(s => s.id === id);
    if(idx >= 0){
      SHEETS[idx] = { ...SHEETS[idx], category: cat, title, description: desc, url, tags, updatedAt };
    }else{
      SHEETS.unshift({ id, category: cat, title, description: desc, url, tags, updatedAt });
    }
    showToast("Link diperbarui");
  }else{
    SHEETS.unshift({ id: uid("s"), category: cat, title, description: desc, url, tags, updatedAt });
    showToast("Link ditambahkan");
  }

  saveSheets(SHEETS);
  resetForm();
  renderAll();
});

exportBtn.addEventListener("click", () => {
  const data = JSON.stringify(SHEETS, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "warehouse-sheets.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Export sukses");
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    if(!Array.isArray(parsed)) throw new Error("Format JSON harus array");
    SHEETS = parsed.map(s => ({
      id: s.id || uid("s"),
      title: String(s.title || "Untitled"),
      description: s.description ? String(s.description) : "",
      category: ["Umum","Finishgood","Material"].includes(s.category) ? s.category : "Umum",
      url: String(s.url || ""),
      tags: Array.isArray(s.tags) ? s.tags.map(t => String(t).toLowerCase()) : normalizeTags(String(s.tags||"")),
      updatedAt: s.updatedAt ? String(s.updatedAt) : new Date().toISOString().slice(0,10)
    }));
    saveSheets(SHEETS);
    renderAll();
    showToast("Import sukses");
  }catch(err){
    alert("Gagal import: " + (err && err.message ? err.message : String(err)));
  }finally{
    importFile.value = "";
  }
});

resetAllBtn.addEventListener("click", () => {
  if(!confirm("Reset ke default? Semua perubahan admin di perangkat ini akan hilang.")) return;
  SHEETS = structuredClone(DEFAULT_SHEETS);
  saveSheets(SHEETS);
  resetForm();
  renderAll();
  showToast("Reset selesai");
});

// ===== Init =====
function init(){
  buildSkeleton();
  resetForm();
  buildTagRow();
  render();
}
init();
