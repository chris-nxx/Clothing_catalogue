// ====== SETTINGS ======
const BASE_URL = "http://localhost:8000";   // where your FastAPI is running
const PAGE_SIZE = 20;                        // matches the API default
const CURRENCY = "KSh";

// ====== SMALL HELPERS ======
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) n.append(kid instanceof Node ? kid : document.createTextNode(kid ?? ""));
  return n;
}

// The API's field names might differ slightly, so look for the first one that exists.
function pick(obj, names) {
  for (const n of names) if (obj && obj[n] !== undefined && obj[n] !== null) return obj[n];
  return undefined;
}
const FIELDS = {
  id: ["id", "product_id", "item_id", "clothing_item_id"],
  name: ["name", "product_name", "item_name", "title"],
  price: ["price", "unit_price"],
  pic: ["picture_path", "picture", "image_path", "image"],
  store: ["store_name", "store"],
  category: ["category_name", "category"],
};

// Turn any value into readable text
function txt(v) {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.map(txt).join(", ");
  if (typeof v === "object") return Object.entries(v).filter(([k]) => !k.endsWith("id")).map(([, x]) => txt(x)).join(" × ");
  return String(v);
}
const nice = (k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const money = (p) => (p === undefined ? "" : `${CURRENCY} ${Number(p).toLocaleString()}`);
const listOf = (d) => (Array.isArray(d) ? d : d.items || d.products || d.results || d.data || []);

// For dropdown options (could be strings or objects like {category_id, category_name})
function optId(o) {
  if (typeof o !== "object") return o;
  for (const k of Object.keys(o)) if (k === "id" || k.endsWith("_id")) return o[k];
}
function optLabel(o) {
  if (typeof o !== "object") return String(o);
  for (const k of Object.keys(o)) if (typeof o[k] === "string") return o[k];
  return String(optId(o));
}

// ====== API ======
let token = null;
try { token = localStorage.getItem("token"); } catch (e) {}

function showBanner(msg) { const b = $("#banner"); b.textContent = msg; b.hidden = !msg; }

async function api(path, { method = "GET", body, form, auth = false } = {}) {
  const headers = {};
  let payload;
  if (auth && token) headers["Authorization"] = "Bearer " + token;
  if (form) payload = new URLSearchParams(form);
  else if (body) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(BASE_URL + path, { method, headers, body: payload });
  } catch (e) {
    showBanner("Can't reach the API at " + BASE_URL + ". Is uvicorn running, and is this page's address in ALLOWED_ORIGINS?");
    throw e;
  }
  showBanner("");
  if (res.status === 401 && auth) logout(true);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const d = data && data.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join("; ") : "Error " + res.status;
    throw new Error(msg);
  }
  return data;
}

// ====== TABS ======
function show(view) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + view));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  if (view === "stores") loadStores();
  if (view === "owner") refreshOwner();
}
$$("[data-view]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); show(b.dataset.view); }));

// ====== SHOP: FILTERS ======
// Filters: which API parameter each dropdown should use is discovered from /openapi.json
const FILTER_DEFS = [
  { key: "category", match: "categor", endpoint: "/categories", label: "Category" },
  { key: "audience", match: "audience", endpoint: "/audiences", label: "Audience" },
  { key: "material", match: "material", endpoint: "/materials", label: "Material" },
  { key: "size", match: "size", endpoint: "/sizes", label: "Size" },
  { key: "store", match: "store", endpoint: "/stores", label: "Store" },
];
const state = { offset: 0, params: {}, paramNames: {} };

async function discoverParams() {
  let names = [];
  try {
    const spec = await api("/openapi.json");
    names = (spec.paths["/products"].get.parameters || []).map((p) => p.name);
  } catch (e) { /* fall back to guesses below */ }
  for (const f of FILTER_DEFS) {
    state.paramNames[f.key] = names.find((n) => n.includes(f.match)) || f.key + "_id";
  }
  state.paramNames.min = names.find((n) => n.includes("min")) || "min_price";
  state.paramNames.max = names.find((n) => n.includes("max")) || "max_price";
}

async function buildFilters() {
  const box = $("#filters");
  for (const f of FILTER_DEFS) {
    const sel = el("select", { id: "f-" + f.key }, el("option", { value: "" }, "All"));
    const wrap = el("div", { class: "field" }, el("label", {}, f.label), sel);
    box.insertBefore(wrap, $(".field.price"));
    try {
      const opts = listOf(await api(f.endpoint));
      const useId = state.paramNames[f.key].endsWith("id");
      for (const o of opts) {
        sel.append(el("option", { value: useId ? optId(o) : optLabel(o) }, optLabel(o)));
      }
    } catch (e) { sel.disabled = true; }
  }
}

function readFilters() {
  const p = {};
  for (const f of FILTER_DEFS) {
    const v = $("#f-" + f.key).value;
    if (v !== "") p[state.paramNames[f.key]] = v;
  }
  if ($("#min_price").value !== "") p[state.paramNames.min] = $("#min_price").value;
  if ($("#max_price").value !== "") p[state.paramNames.max] = $("#max_price").value;
  return p;
}

// ====== SHOP: PRODUCTS ======
function thumb(p, big) {
  const path = pick(p, FIELDS.pic);
  const name = txt(pick(p, FIELDS.name)) || "?";
  const box = el("div", { class: "thumb" }, name[0].toUpperCase());
  if (path) {
    const img = el("img", { src: BASE_URL + "/" + path, alt: name, loading: "lazy" });
    img.addEventListener("load", () => { box.textContent = ""; box.append(img); });
    // If the picture file doesn't exist yet, the letter placeholder stays.
  }
  return box;
}

function card(p) {
  const sub = [txt(pick(p, FIELDS.store)), txt(pick(p, FIELDS.category))].filter(Boolean).join(" · ");
  return el("button", { class: "card", onclick: () => openDetail(pick(p, FIELDS.id)) },
    thumb(p),
    el("div", { class: "info" },
      el("div", { class: "name" }, txt(pick(p, FIELDS.name))),
      el("div", { class: "price" }, money(pick(p, FIELDS.price))),
      el("div", { class: "sub" }, sub)));
}

async function loadProducts() {
  const q = new URLSearchParams({ ...state.params, limit: PAGE_SIZE, offset: state.offset });
  const grid = $("#grid");
  try {
    const items = listOf(await api("/products?" + q));
    grid.replaceChildren(...items.map(card));
    $("#count").textContent = items.length ? "" : "No products match those filters.";
    const pageNo = state.offset / PAGE_SIZE + 1;
    $("#page").textContent = "Page " + pageNo;
    $("#prev").disabled = state.offset === 0;
    $("#next").disabled = items.length < PAGE_SIZE;
  } catch (e) { grid.replaceChildren(); $("#count").textContent = "Couldn't load products: " + e.message; }
}

$("#apply").addEventListener("click", () => { state.params = readFilters(); state.offset = 0; loadProducts(); });
$("#reset").addEventListener("click", () => {
  $$("#filters select, #filters input").forEach((i) => (i.value = ""));
  state.params = {}; state.offset = 0; loadProducts();
});
$("#prev").addEventListener("click", () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); loadProducts(); window.scrollTo(0, 0); });
$("#next").addEventListener("click", () => { state.offset += PAGE_SIZE; loadProducts(); window.scrollTo(0, 0); });

// ====== PRODUCT DETAIL ======
async function openDetail(id) {
  try {
    const p = await api("/products/" + id);
    const skip = [...FIELDS.id, ...FIELDS.name, ...FIELDS.price, ...FIELDS.pic];
    const dl = el("dl");
    for (const [k, v] of Object.entries(p)) {
      if (skip.includes(k) || k.endsWith("_id") || v === null || v === "") continue;
      dl.append(el("dt", {}, nice(k)), el("dd", {}, txt(v)));
    }
    $("#detail").replaceChildren(el("div", { class: "detail" }, thumb(p, true),
      el("div", { class: "body" },
        el("h2", {}, txt(pick(p, FIELDS.name))),
        el("div", { class: "price" }, money(pick(p, FIELDS.price))), dl)));
    $("#modal").hidden = false;
  } catch (e) { showBanner("Couldn't load that product: " + e.message); }
}
$("#close").addEventListener("click", () => ($("#modal").hidden = true));
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").hidden = true; });

// ====== STORES ======
async function loadStores() {
  try {
    const stores = listOf(await api("/stores"));
    $("#stores").replaceChildren(...stores.map((s) => {
      const o = typeof s === "object" ? s : { name: s };
      const name = txt(pick(o, ["name", "store_name"])) || optLabel(o);
      const rest = Object.entries(o)
        .filter(([k, v]) => !k.endsWith("id") && !["name", "store_name"].includes(k) && v !== null)
        .map(([k, v]) => el("div", { class: "sub muted" }, nice(k) + ": " + txt(v)));
      return el("div", { class: "card" }, el("div", { class: "big" }, name), ...rest);
    }));
  } catch (e) { $("#stores").textContent = "Couldn't load stores: " + e.message; }
}

// ====== OWNER / ADMIN ======
function setMsg(sel, text, ok) { const m = $(sel); m.textContent = text; m.className = "msg " + (text ? (ok ? "ok" : "err") : ""); }

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("/login", { method: "POST", form: { username: $("#email").value, password: $("#password").value } });
    token = r.access_token;
    try { localStorage.setItem("token", token); } catch (x) {}
    $("#password").value = "";
    setMsg("#login-msg", "");
    refreshOwner();
  } catch (err) { setMsg("#login-msg", err.message === "Error 401" ? "Wrong email or password" : err.message); }
});

function logout(expired) {
  token = null;
  try { localStorage.removeItem("token"); } catch (e) {}
  refreshOwner();
  if (expired) setMsg("#login-msg", "Your session expired. Please log in again.");
}
$("#logout").addEventListener("click", () => logout());

async function refreshOwner() {
  const loggedIn = !!token;
  $("#login-box").hidden = loggedIn;
  $("#dash").hidden = !loggedIn;
  if (!loggedIn) return;
  try {
    const me = await api("/me", { auth: true });
    $("#who").textContent = txt(pick(me, ["email"])) + (me.role ? " (" + me.role + ")" : "") + " ";
    $("#admin-box").hidden = me.role !== "admin";
    if (me.role === "admin") { $("#mine").replaceChildren(); setMsg("#dash-msg", "Admins don't own a store. Use the form below to create owner logins."); }
    else loadMine();
  } catch (e) { /* logout() already handled a 401 */ }
}

async function loadMine() {
  setMsg("#dash-msg", "");
  try {
    const items = listOf(await api("/my/products", { auth: true }));
    if (!items.length) { $("#mine").replaceChildren(el("p", { class: "muted" }, "Your store has no products yet.")); return; }
    $("#mine").replaceChildren(...items.map((p) => {
      const id = pick(p, FIELDS.id);
      return el("div", { class: "row" },
        el("div", { class: "grow" },
          el("div", { class: "t" }, txt(pick(p, FIELDS.name))),
          el("div", { class: "muted" }, money(pick(p, FIELDS.price)))),
        el("div", { class: "actions" },
          el("button", { class: "btn ghost small", onclick: () => editPrice(id, pick(p, FIELDS.price)) }, "Edit price"),
          el("button", { class: "btn danger small", onclick: () => removeProduct(id, txt(pick(p, FIELDS.name))) }, "Delete")));
    }));
  } catch (e) { setMsg("#dash-msg", e.message); }
}

async function editPrice(id, current) {
  const v = prompt("New price:", current);
  if (v === null) return;
  const price = Number(v);
  if (!(price > 0)) { setMsg("#dash-msg", "Price must be a number above 0."); return; }
  try { await api("/products/" + id, { method: "PATCH", body: { price }, auth: true }); loadMine(); loadProducts(); setMsg("#dash-msg", "Price updated.", true); }
  catch (e) { setMsg("#dash-msg", e.message); }
}

async function removeProduct(id, name) {
  if (!confirm("Delete “" + name + "”? This can't be undone.")) return;
  try { await api("/products/" + id, { method: "DELETE", auth: true }); loadMine(); loadProducts(); setMsg("#dash-msg", "Deleted.", true); }
  catch (e) { setMsg("#dash-msg", e.message); }
}

$("#owner-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/admin/owners", { method: "POST", auth: true,
      body: { email: $("#o-email").value, password: $("#o-pass").value, store_id: Number($("#o-store").value) } });
    setMsg("#owner-msg", "Owner created.", true);
    $("#o-email").value = ""; $("#o-pass").value = ""; $("#o-store").value = "";
  } catch (err) { setMsg("#owner-msg", err.message); }
});

// ====== START ======
(async function init() {
  await discoverParams();
  await buildFilters();
  loadProducts();
})();
