// ====== SETTINGS ======
const BASE_URL = "http://localhost:8000";   // where your FastAPI is running
const PAGE_SIZE = 20;
const CURRENCY = "KSh";

// ====== HELPERS ======
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) n.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return n;
}
const money = (p) => `${CURRENCY} ${Number(p).toLocaleString()}`;

function toast(msg, ok = true) {
  const t = el("div", { class: "toast" + (ok ? "" : " err") }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ok ? 2800 : 6000);
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
    throw new Error("Can't reach the API");
  }
  showBanner("");
  if (res.status === 401 && auth) logout(true);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const d = data && data.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => (x.loc ? x.loc.slice(-1) + ": " : "") + x.msg).join("; ") : "Error " + res.status);
  }
  return data;
}

// Lookup lists (categories, sizes, ...) are fetched once and reused
const lookupCache = {};
const lookup = (endpoint) => (lookupCache[endpoint] ??= api(endpoint).catch((e) => { delete lookupCache[endpoint]; throw e; }));

// ====== TABS ======
function show(view) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + view));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  if (view === "stores") loadStores();
  if (view === "owner") refreshOwner();
}
$$("[data-view]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); show(b.dataset.view); }));

// ====== SHOP ======
const FILTERS = [
  { param: "category_id", endpoint: "/categories", label: "Category", name: "category_name" },
  { param: "audience_id", endpoint: "/audiences", label: "Audience", name: "audience_name" },
  { param: "material_id", endpoint: "/materials", label: "Material", name: "material_name" },
  { param: "size_id", endpoint: "/sizes", label: "Size", name: "size_label" },
  { param: "mall_id", endpoint: "/malls", label: "Mall", name: "mall_name" },
  { param: "store_id", endpoint: "/stores", label: "Store", name: "store_name" },
];
const state = { offset: 0, params: {} };

async function buildFilters() {
  for (const f of FILTERS) {
    const sel = el("select", { id: "f-" + f.param }, el("option", { value: "" }, "All"));
    $("#filters").insertBefore(el("div", { class: "field" }, el("label", {}, f.label), sel), $(".field.price"));
    try { (await lookup(f.endpoint)).forEach((o) => sel.append(el("option", { value: o[f.param] }, o[f.name]))); }
    catch (e) { sel.disabled = true; }
  }
}

function readFilters() {
  const p = {};
  for (const f of FILTERS) { const v = $("#f-" + f.param).value; if (v) p[f.param] = v; }
  if ($("#search").value.trim()) p.search = $("#search").value.trim();
  if ($("#min_price").value !== "") p.min_price = $("#min_price").value;
  if ($("#max_price").value !== "") p.max_price = $("#max_price").value;
  return p;
}

function thumb(p) {
  const box = el("div", { class: "thumb" }, p.product_name[0].toUpperCase());
  if (p.picture_path) {
    const img = el("img", { src: BASE_URL + "/" + p.picture_path, alt: p.product_name, loading: "lazy" });
    img.addEventListener("load", () => { box.textContent = ""; box.append(img); });
    // if the file doesn't exist yet, the letter placeholder stays
  }
  return box;
}

function card(p) {
  return el("button", { class: "card", onclick: () => openDetail(p.product_id) },
    thumb(p),
    el("div", { class: "info" },
      el("div", { class: "name" }, p.product_name),
      el("div", { class: "price" }, money(p.price)),
      el("div", { class: "sub" }, [p.store_name, p.category_name].filter(Boolean).join(" · "))));
}

async function loadProducts() {
  const q = new URLSearchParams({ ...state.params, limit: PAGE_SIZE, offset: state.offset });
  try {
    const items = await api("/products?" + q);
    $("#grid").replaceChildren(...items.map(card));
    $("#count").textContent = items.length ? "" : "No products match those filters.";
    $("#page").textContent = "Page " + (state.offset / PAGE_SIZE + 1);
    $("#prev").disabled = state.offset === 0;
    $("#next").disabled = items.length < PAGE_SIZE;
  } catch (e) { $("#grid").replaceChildren(); $("#count").textContent = "Couldn't load products: " + e.message; }
}

function applyFilters() { state.params = readFilters(); state.offset = 0; loadProducts(); }
$("#apply").addEventListener("click", applyFilters);
$("#search").addEventListener("keydown", (e) => { if (e.key === "Enter") applyFilters(); });
$("#reset").addEventListener("click", () => { $$("#filters select, #filters input").forEach((i) => (i.value = "")); applyFilters(); });
$("#prev").addEventListener("click", () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); loadProducts(); window.scrollTo(0, 0); });
$("#next").addEventListener("click", () => { state.offset += PAGE_SIZE; loadProducts(); window.scrollTo(0, 0); });

// ====== PRODUCT DETAIL ======
async function openDetail(id) {
  try {
    const p = await api("/products/" + id);
    const rows = [
      ["Store", p.store_name], ["Mall", p.mall_name], ["Floor", p.floor_level],
      ["Category", p.category_name], ["Audience", p.audience_name], ["Colour", p.colour],
      ["Materials", (p.materials || []).join(", ")],
    ].filter(([, v]) => v);
    const dl = el("dl");
    rows.forEach(([k, v]) => dl.append(el("dt", {}, k), el("dd", {}, v)));
    const sizes = (p.sizes || []).length
      ? el("div", { class: "chips" }, p.sizes.map((s) =>
          el("span", { class: "chip" + (s.quantity_available > 0 ? "" : " out") },
            s.size_label + (s.quantity_available > 0 ? " · " + s.quantity_available + " left" : " · sold out"))))
      : el("span", { class: "muted" }, "No size information yet");
    $("#detail").replaceChildren(el("div", { class: "detail" }, thumb(p),
      el("div", { class: "body" },
        el("h2", {}, p.product_name),
        el("div", { class: "price" }, money(p.price)),
        p.description ? el("p", { class: "desc" }, p.description) : null,
        dl, el("h4", { class: "muted" }, "Sizes"), sizes)));
    $("#modal").hidden = false;
  } catch (e) { toast("Couldn't load that product: " + e.message, false); }
}
$("#close").addEventListener("click", () => ($("#modal").hidden = true));
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").hidden = true; });

// ====== STORES ======
async function loadStores() {
  try {
    const stores = await api("/stores");
    $("#stores").replaceChildren(...stores.map((s) => {
      const place = [s.mall_name, s.area, s.floor_level, s.shop_number && "Shop " + s.shop_number].filter(Boolean).join(" · ");
      return el("div", { class: "card" },
        el("div", { class: "big" }, s.store_name),
        el("div", { class: "sub muted" }, place),
        s.phone ? el("div", { class: "sub muted" }, s.phone) : null,
        s.email ? el("div", { class: "sub muted" }, s.email) : null,
        el("div", { class: "sub" }, s.product_count + " product" + (s.product_count === 1 ? "" : "s")),
        el("button", { class: "btn ghost small", style: "margin-top:10px", onclick: () => shopStore(s.store_id) }, "View products"));
    }));
  } catch (e) { $("#stores").textContent = "Couldn't load stores: " + e.message; }
}
function shopStore(id) {
  $$("#filters select, #filters input").forEach((i) => (i.value = ""));
  $("#f-store_id").value = id;
  show("shop"); applyFilters();
}

// ====== LOGIN / LOGOUT ======
function setMsg(sel, text) { const m = $(sel); m.textContent = text; m.className = "msg" + (text ? " err" : ""); }

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("/login", { method: "POST", form: { username: $("#email").value, password: $("#password").value } });
    token = r.access_token;
    try { localStorage.setItem("token", token); } catch (x) {}
    $("#password").value = ""; setMsg("#login-msg", "");
    refreshOwner();
  } catch (err) { setMsg("#login-msg", err.message); }
});

function logout(expired) {
  token = null;
  try { localStorage.removeItem("token"); } catch (e) {}
  refreshOwner();
  if (expired) setMsg("#login-msg", "Your session expired. Please log in again.");
}
$("#logout").addEventListener("click", () => logout());

async function refreshOwner() {
  $("#login-box").hidden = !!token;
  $("#dash").hidden = !token;
  if (!token) return;
  try {
    const me = await api("/me", { auth: true });
    const isAdmin = me.role === "admin";
    $("#who").textContent = me.email + " (" + me.role + ") ";
    $("#dash-title").textContent = isAdmin ? "Admin" : "My products";
    $("#owner-tools").hidden = isAdmin;
    $("#admin-box").hidden = !isAdmin;
    if (isAdmin) fillSelect("#o-store", "/stores", "store_id", "store_name");
    else { fillSelect("#a-category", "/categories", "category_id", "category_name"); fillSelect("#a-audience", "/audiences", "audience_id", "audience_name"); loadMine(); }
  } catch (e) { /* a 401 is already handled by logout() */ }
}

async function fillSelect(sel, endpoint, idKey, nameKey) {
  const s = $(sel);
  if (s.options.length) return;
  try { (await lookup(endpoint)).forEach((o) => s.append(el("option", { value: o[idKey] }, o[nameKey]))); } catch (e) {}
}

// ====== OWNER: PRODUCT LIST ======
async function loadMine() {
  try {
    const items = await api("/my/products", { auth: true });
    $("#mine").replaceChildren(...(items.length ? items.map(mineRow) : [el("p", { class: "muted" }, "Your store has no products yet.")]));
  } catch (e) { toast(e.message, false); }
}

function mineRow(p) {
  const title = el("div", { class: "t" }, p.product_name);
  const price = el("div", { class: "muted" }, money(p.price));
  const panel = el("div", { class: "manage", hidden: "" });
  const wrap = el("div", {});
  let built = false;
  const row = el("div", { class: "row" },
    el("div", { class: "grow" }, title, price),
    el("div", { class: "actions" },
      el("button", { class: "btn ghost small", onclick: async () => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden && !built) { built = true; await buildManage(p.product_id, panel, title, price); }
      } }, "Manage"),
      el("button", { class: "btn danger small", onclick: async () => {
        if (!confirm("Delete “" + p.product_name + "”? This can't be undone.")) return;
        try { await api("/products/" + p.product_id, { method: "DELETE", auth: true }); toast("Deleted."); wrap.remove(); loadProducts(); }
        catch (e) { toast(e.message, false); }
      } }, "Delete")));
  wrap.append(row, panel);
  return wrap;
}

async function buildManage(id, panel, titleEl, priceEl) {
  let detail, sizes, materials;
  try { [detail, sizes, materials] = await Promise.all([api("/products/" + id), lookup("/sizes"), lookup("/materials")]); }
  catch (e) { toast(e.message, false); panel.hidden = true; return; }

  // 1) Details
  const name = el("input", { value: detail.product_name });
  const price = el("input", { type: "number", step: "any", min: "1", value: detail.price });
  const colour = el("input", { value: detail.colour || "" });
  const desc = el("input", { value: detail.description || "" });
  const saveDetails = el("button", { class: "btn small", onclick: async () => {
    const body = { product_name: name.value.trim(), price: Number(price.value), colour: colour.value, description: desc.value };
    if (!body.product_name || !(body.price > 0)) return toast("Name is required and price must be above 0.", false);
    try {
      await api("/products/" + id, { method: "PATCH", body, auth: true });
      titleEl.textContent = body.product_name; priceEl.textContent = money(body.price);
      toast("Details saved."); loadProducts();
    } catch (e) { toast(e.message, false); }
  } }, "Save details");

  // 2) Stock
  const have = Object.fromEntries((detail.sizes || []).map((s) => [s.size_label, s.quantity_available]));
  const stockInputs = sizes.map((s) => ({ s, input: el("input", { type: "number", min: "0", placeholder: "—", value: have[s.size_label] ?? "" }) }));
  const saveStock = el("button", { class: "btn small", onclick: async () => {
    let saved = 0;
    try {
      for (const { s, input } of stockInputs) {
        if (input.value === "" || String(have[s.size_label]) === input.value) continue;
        await api(`/products/${id}/sizes/${s.size_id}`, { method: "PUT", body: { quantity_available: Number(input.value) }, auth: true });
        have[s.size_label] = Number(input.value); saved++;
      }
      toast(saved ? "Stock saved." : "No stock changes to save."); 
    } catch (e) { toast(e.message, false); }
  } }, "Save stock");

  // 3) Materials
  const checks = materials.map((m) => ({ m, box: el("input", { type: "checkbox", ...((detail.materials || []).includes(m.material_name) ? { checked: "" } : {}) }) }));
  const saveMats = el("button", { class: "btn small", onclick: async () => {
    const ids = checks.filter((c) => c.box.checked).map((c) => c.m.material_id);
    try { await api(`/products/${id}/materials`, { method: "PUT", body: { material_id: ids }, auth: true }); toast("Materials saved."); }
    catch (e) { toast(e.message, false); }
  } }, "Save materials");

  panel.append(
    el("div", {}, el("h4", {}, "Details"),
      el("div", { class: "form-grid" },
        el("div", { class: "field" }, el("label", {}, "Name"), name),
        el("div", { class: "field" }, el("label", {}, "Price"), price),
        el("div", { class: "field" }, el("label", {}, "Colour"), colour),
        el("div", { class: "field" }, el("label", {}, "Description"), desc),
        el("div", { class: "wide" }, saveDetails))),
    el("div", {}, el("h4", {}, "Stock per size (leave blank if you don't sell that size)"),
      el("div", { class: "stock-grid" }, stockInputs.map(({ s, input }) => el("div", { class: "field" }, el("label", {}, s.size_label), input))), saveStock),
    el("div", {}, el("h4", {}, "Materials"),
      el("div", { class: "checks" }, checks.map(({ m, box }) => el("label", {}, box, m.material_name))), saveMats));
}

// ====== OWNER: ADD PRODUCT ======
$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    product_name: $("#a-name").value.trim(),
    price: Number($("#a-price").value),
    category_id: Number($("#a-category").value),
    audience_id: Number($("#a-audience").value),
  };
  if ($("#a-colour").value.trim()) body.colour = $("#a-colour").value.trim();
  if ($("#a-desc").value.trim()) body.description = $("#a-desc").value.trim();
  if ($("#a-pic").value.trim()) body.picture_path = $("#a-pic").value.trim();
  try {
    await api("/products", { method: "POST", body, auth: true });
    toast("Product added. Open Manage to set its sizes, stock and materials.");
    e.target.reset(); $("#add-box").open = false;
    loadMine(); loadProducts();
  } catch (err) { toast(err.message, false); }
});

// ====== ADMIN: CREATE OWNER ======
$("#owner-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/admin/owners", { method: "POST", auth: true,
      body: { email: $("#o-email").value, password: $("#o-pass").value, store_id: Number($("#o-store").value) } });
    toast("Owner created.");
    e.target.reset();
  } catch (err) { toast(err.message, false); }
});

// ====== START ======
buildFilters();
loadProducts();
