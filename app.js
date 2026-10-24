/* Справочник экономиста — приложение v1 (этап 1: Главная, Остатки, Разнарядки, загрузка данных). */
"use strict";

const APP_VERSION = "2.1.1";
const LS_DATA = "spr_data_v1";
const LS_SET = "spr_settings_v1";

/* ───────── хранилище ───────── */
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

let DATA = lsGet(LS_DATA, null);
let SET = Object.assign({ theme: "auto", porog: 15 }, lsGet(LS_SET, {}));
let Q = "";            // строка поиска
let lastRoute = "";
const openGroups = new Set();

/* ───────── формат ───────── */
const nf1 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
function T(kg) { return nf1.format((kg || 0) / 1000); }                       // тонны
function W(kg) { const a = Math.abs(kg || 0); return a < 1000 ? nf0.format(kg) + " кг" : T(kg) + " т"; }  // кг или т
function N(x) { return nf0.format(x || 0); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function low(s) { return String(s || "").toLowerCase().replace(/ё/g, "е"); }
function match(q, ...fields) { if (!q) return true; const t = low(fields.join(" ")); return low(q).split(/\s+/).filter(Boolean).every((w) => t.includes(w)); }
function parseRu(d) { const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(d || ""); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
function daysOld(d) { const x = parseRu(d); if (!x) return 0; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((t - x) / 864e5); }
function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }

/* ───────── иконки (из макета) ───────── */
const I = {
  home: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>',
  stock: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>',
  ship: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6h11.5v10H2.5z"/><path d="M14 9h4l3.5 3.5V16H14"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>',
  staff: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.6.7 2.6 2.3 3 4.6"/></svg>',
  req: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/></svg>',
  more: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true" style="color:var(--muted);flex:none"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:1px"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17v.4"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--muted)"><path d="M9 5l7 7-7 7"/></svg>',
  upload: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v4h16v-4"/></svg>'
};

/* ───────── тема ───────── */
function applyTheme() {
  const dark = SET.theme === "dark" || (SET.theme === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? "#0F1210" : "#F3F1EA";
  return dark;
}
function isDark() { return document.documentElement.dataset.theme === "dark"; }

/* ───────── чтение архива (zip) без библиотек ───────── */
async function unzip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("это не zip-архив");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder("utf-8");
  const out = {};
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("архив повреждён");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const loff = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    p += 46 + nlen + xlen + clen;
    const lnl = dv.getUint16(loff + 26, true), lxl = dv.getUint16(loff + 28, true);
    const data = new Uint8Array(buf, loff + 30 + lnl + lxl, csize);
    let text;
    if (method === 0) text = dec.decode(data);
    else if (method === 8) {
      const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      text = await new Response(s).text();
    } else throw new Error("неизвестный способ сжатия");
    out[name] = text;
  }
  return out;
}

async function loadArchive(file, force) {
  const files = await unzip(await file.arrayBuffer());
  const need = ["meta.json", "ostatki.json", "zerno.json", "meshki.json", "raznaryadki.json"];
  for (const n of need) if (!files[n]) throw new Error("в архиве нет файла " + n);
  const d = {
    meta: JSON.parse(files["meta.json"]), ostatki: JSON.parse(files["ostatki.json"]),
    zerno: JSON.parse(files["zerno.json"]), meshki: JSON.parse(files["meshki.json"]),
    razn: JSON.parse(files["raznaryadki.json"]), loadedAt: new Date().toLocaleString("ru-RU"), fileName: file.name
  };
  if (files["vyrabotka.json"]) d.vyr = JSON.parse(files["vyrabotka.json"]);
  if (files["gsm.json"]) d.gsm = JSON.parse(files["gsm.json"]);
  if (files["personal.json"]) {
    const j = (n) => files[n] ? JSON.parse(files[n]) : null;
    d.pers = { personal: j("personal.json"), shtat: j("shtat.json"), tabel: j("tabel.json"), prikazy: j("prikazy.json"), zarplata: j("zarplata.json") };
  }
  if (DATA && !force) {
    const a = parseRu(d.meta.data_na_utro), b = parseRu(DATA.meta.data_na_utro);
    if (a && b && a < b) return { older: true, d };
  }
  return { d };
}

function saveData(d) {
  DATA = d;
  zpLock();
  if (!lsSet(LS_DATA, d)) toast("Не удалось сохранить данные в памяти телефона");
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* */ }
}

/* ───────── выборки ───────── */
const GROUPS = [
  { id: "muka", label: "Мука", g: "Мука" },
  { id: "korm", label: "Кормовая мука и отруби", g: "Кормовая мука и отруби" },
  { id: "krupa", label: "Крупа", g: "Крупа" },
  { id: "kombi", label: "Комбикорм", g: "Комбикорм" }
];
const CHIPS = [{ id: "all", label: "Все" }, ...GROUPS, { id: "zerno", label: "Зерно" }, { id: "tara", label: "Мешкотара" }, { id: "gsm", label: "ГСМ и уголь" }];

function products() { return DATA ? DATA.ostatki.pozicii : []; }
function razn() { return DATA ? DATA.razn.stroki : []; }
function isK(x) { return x.tip === "kombikorm"; }
function tara() { return DATA ? DATA.meshki.pozicii : []; }
function zerno() { return DATA ? DATA.zerno.kultury : []; }
function byKey(list, key) { return list.find((x) => x.key === key); }
function taraLow() { return tara().filter((x) => x.v_rabote && x.hvatit_dney != null && x.hvatit_dney < SET.porog).sort((a, b) => a.hvatit_dney - b.hvatit_dney); }
function daysCls(d) { if (d == null) return "b-mute"; if (d < 7) return "b-bad"; if (d < SET.porog) return "b-warn"; return "b-ok"; }
function daysTxt(d) { return d == null ? "нет расхода" : "~" + nf0.format(Math.floor(d)) + " " + plural(Math.floor(d), "день", "дня", "дней"); }

/* ───────── навигация ───────── */
/* позиция списка: уходя вперёд, запоминаем прокрутку и поиск; по «Назад» — возвращаем */
const SAVED = {};
let navFwd = false, pendingQ = null;
function go(h) {
  if (location.hash === h) { render(); return; }
  SAVED[location.hash || "#home"] = { y: document.getElementById("main").scrollTop, q: Q };
  navFwd = true;
  location.hash = h;
}
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [a, ...rest] = h.split("/");
  return { a: a || "home", b: rest.join("/") };
}
window.addEventListener("hashchange", () => {
  if (location.hash === "#share") { takeShared(); return; }
  if (syncTakeSetup()) { render(); return; }
  const s = !navFwd && SAVED[location.hash || "#home"];
  navFwd = false;
  if (s) pendingQ = s.q;
  render();
  document.getElementById("main").scrollTop = s ? s.y : 0;
});

const TABS = [
  { id: "home", label: "Главная", ic: I.home, h: "#home", act: ["home", "vyr", "vyrd"] },
  { id: "stock", label: "Остатки", ic: I.stock, h: "#stock/all", act: ["stock", "item", "zerno", "tara", "taraall"] },
  { id: "razn", label: "Разнарядки", ic: I.ship, h: "#razn/active", act: ["razn", "rz", "kontr"] },
  { id: "staff", label: "Персонал", ic: I.staff, h: "#staff", act: ["staff", "emp", "dep"] },
  { id: "req", label: "Заявки", ic: I.req, h: "#req", act: ["req"] },
  { id: "more", label: "Ещё", ic: I.more, h: "#more", act: ["more", "load", "about", "settings", "shtat"] }
];

function renderNav(r) {
  document.getElementById("nav").innerHTML = TABS.map((t) =>
    `<button class="${t.act.includes(r.a) ? "on" : ""}" aria-label="${t.label}" data-go="${t.h}"><span class="pill">${t.ic}</span><span class="lbl">${t.label}</span></button>`).join("");
}

function header(sub, ph) {
  const d = DATA ? DATA.meta.data_na_utro : null;
  const old = d ? daysOld(d) : 0;
  const cls = old > 3 ? "vold" : old >= 1 ? "old" : "";
  const oldTxt = old >= 1 ? ` · ${old} ${plural(old, "день", "дня", "дней")} назад` : "";
  return `<header>
    <div class="hrow">
      <div style="flex:1;min-width:0">
        <div class="hsub">${esc(sub)}${oldTxt}</div>
        <div class="hdate num ${cls}">${d ? "Данные на " + esc(d) : "Нет данных"}</div>
      </div>
      <button class="iconbtn boxed" aria-label="Сменить тему" data-act="theme">${isDark() ? I.sun : I.moon}</button>
    </div>
    <label class="search">${I.search}
      <input id="q" type="search" enterkeyhint="search" aria-label="Поиск" placeholder="${esc(ph)}" value="${esc(Q)}" autocomplete="off">
      <button class="iconbtn" id="qx" style="width:40px;height:40px;color:var(--muted);${Q ? "" : "display:none"}" aria-label="Очистить поиск" data-act="clearq">${I.x}</button>
    </label>
  </header>`;
}

function backbar(kind, title) {
  const d = DATA ? " · на " + DATA.meta.data_na_utro : "";
  return `<div class="backbar">
    <button class="iconbtn" style="width:48px;height:48px" aria-label="Назад" data-act="back">${I.back}</button>
    <div style="flex:1;min-width:0"><div class="t1">${esc(kind)}${esc(d)}</div><div class="t2">${esc(title)}</div></div>
  </div>`;
}

function noData() {
  return `<div class="card big" style="gap:10px">
    <div style="font-size:18px;font-weight:800">Данных пока нет</div>
    <div class="note" style="padding:0">Соберите архив на рабочем ПК («Собрать_для_телефона»), отправьте его себе в Telegram, сохраните в «Загрузки» и загрузите сюда.</div>
    <button class="btn" data-go="#load">${I.upload} Загрузить данные</button>
  </div>`;
}

/* ───────── экраны ───────── */
function viewHome() {
  if (!DATA) return { top: header("Справочник экономиста", "Поиск по всем данным"), main: noData() };
  if (Q) return { top: header("Поиск по всем данным", "Поиск по всем данным"), main: globalSearch() };
  const muka = products().filter((p) => p.gruppa === "Мука").reduce((s, p) => s + p.ostatok_kg, 0);
  const act = razn().filter((x) => x.status === "aktivnaya" && !isK(x));
  const toShip = act.reduce((s, x) => s + x.ostatok_kg, 0);
  const korm = products().filter((p) => p.gruppa === "Кормовая мука и отруби").reduce((s, p) => s + p.ostatok_kg, 0);
  const tiles = [
    { l: "Мука на складе", v: T(muka), u: "т", s: "все мельницы", h: "#stock/muka" },
    { l: "Зерно на элеваторе", v: T(DATA.zerno.itogo_kg), u: "т", s: zerno().length + " " + plural(zerno().length, "культура", "культуры", "культур"), h: "#stock/zerno" },
    { l: "К отгрузке", v: T(toShip), u: "т", s: act.length + " " + plural(act.length, "активная строка", "активные строки", "активных строк"), h: "#razn/active" },
    { l: "Корм. мука и отруби", v: T(korm), u: "т", s: "мельницы и комбикорм", h: "#stock/korm" }
  ];
  const G = { prod: [], tara: [], syrie: [], gsm: gsmAttention(), sbor: [] };
  (DATA.ostatki.vnimanie || []).forEach((a) => {
    if (a.tip === "tara") G.tara.push({ t: a.name, v: "−" + N(-a.svobodno_kg) + " шт", sort: a.svobodno_kg, sub: "под разнарядки", h: "#tara/" + encodeURIComponent(a.key), bad: true });
    else if (a.tip === "syrie") G.syrie.push({ t: a.name, v: "−" + T(-a.svobodno_kg) + " т", sort: a.svobodno_kg, h: "#razn/kombi", bad: true });
    else {
      const p = byKey(products(), a.key);
      if (p) G.prod.push({ t: p.name, v: "−" + W(-p.svobodno_kg), sort: p.svobodno_kg, kg: -p.svobodno_kg, h: "#item/" + encodeURIComponent(a.key), bad: true });
    }
  });
  const taraSeen = new Set(G.tara.map((x) => x.t));
  taraLow().forEach((m) => {
    if (taraSeen.has(m.name) || (m.pod_razn_vmeste || []).some((n) => taraSeen.has(m.pod_razn_vmeste.join(" + ")))) return;
    G.tara.push({ t: m.name, v: daysTxt(m.hvatit_dney), sort: 1e9 + m.hvatit_dney, sub: "запас", h: "#tara/" + encodeURIComponent(m.key), bad: m.hvatit_dney < 7 });
  });
  (DATA.meta.preduprezhdeniya || []).forEach((w) => G.sbor.push({ t: w, v: "", sort: 0, h: "#about" }));
  Object.values(G).forEach((l) => l.sort((a, b) => a.sort - b.sort));
  const groups = [
    { id: "prod", title: "Продукции не хватает под разнарядки", sum: G.prod.length ? "надо вытарить всего " + T(G.prod.reduce((s, x) => s + x.kg, 0)) + " т" : "", go: "#stock/all" },
    { id: "tara", title: "Мешкотара и этикетки", sum: (() => { const d = G.tara.filter((x) => x.sub === "под разнарядки").length, l = G.tara.length - d; return [d ? `не хватает под разнарядки: ${d}` : "", l ? `запас меньше ${SET.porog} дн.: ${l}` : ""].filter(Boolean).join(" · "); })(), go: "#stock/tara" },
    { id: "syrie", title: "Сырьё для комбикорма", sum: "не хватает под потребность хозяйств ТНК", go: "#razn/kombi" },
    { id: "gsm", title: "ГСМ и уголь", sum: `запас меньше ${SET.porog} дн. по среднему расходу`, go: "#stock/gsm" },
    { id: "sbor", title: "Предупреждения сборщика", sum: "проверьте файлы на ПК", go: "#about" }
  ].filter((g) => G[g.id].length);
  const old = daysOld(DATA.meta.data_na_utro);
  let att = old >= 1 ? `<button class="alert ${old > 3 ? "bad" : ""}" data-go="#load"><span class="${old > 3 ? "bad" : "warn"}">${I.warn}</span><span style="flex:1;min-width:0"><span class="a1">Данные устарели</span><span class="a2 num">на ${esc(DATA.meta.data_na_utro)} — обновите архив</span></span></button>` : "";
  att += groups.map((g) => {
    const items = G[g.id], open = openGroups.has(g.id), shown = open ? items : items.slice(0, 3);
    return `<div class="card grp">
      <button class="grph" data-grp="${g.id}">
        <span class="${g.id === "sbor" ? "warn" : "bad"}">${I.warn}</span>
        <span style="flex:1;min-width:0"><span class="a1">${esc(g.title)}</span><span class="a2 num">${esc(g.sum)}</span></span>
        <span class="badge ${g.id === "sbor" ? "b-warn" : "b-bad"} num">${items.length}</span>
      </button>
      ${shown.map((x) => `<button class="grpi" data-go="${x.h}"><span class="gn">${esc(x.t)}</span><span class="gv num ${x.bad ? "bad" : "warn"}">${esc(x.v)}</span></button>`).join("")}
      ${items.length > 3 ? `<button class="grpm" data-grp="${g.id}">${open ? "Свернуть" : "Ещё " + (items.length - 3) + " · показать все"}</button>` : ""}
    </div>`;
  }).join("");
  const total = groups.reduce((s, g) => s + G[g.id].length, 0) + (old >= 1 ? 1 : 0);
  return {
    top: header("Справочник экономиста · ТОО «Урожай»", "Поиск по всем данным"),
    main: `<div class="tiles">${tiles.map((t) => `<button class="tile" data-go="${t.h}"><span class="l">${t.l}</span><span class="v num">${t.v} <small>${t.u}</small></span><span class="s">${esc(t.s)}</span></button>`).join("")}${vyrTile()}</div>
    ${homeAbsent()}
    <div class="h2">Требует внимания${total ? " · " + total : ""}</div>
    ${att || `<div class="card empty" style="padding:16px">Всё в порядке</div>`}
    <div class="note">Мешки: предупреждение, если хватит меньше чем на ${SET.porog} дней (меняется в «Ещё → Настройки»).</div>`
  };
}

function globalSearch() {
  const res = [];
  products().forEach((p) => match(Q, p.name, p.gruppa) && res.push({ ty: "Остаток", t: p.name, s: `${W(p.ostatok_kg)} · свободно ${W(p.svobodno_kg)}`, h: "#item/" + encodeURIComponent(p.key) }));
  zerno().forEach((z) => {
    if (match(Q, z.kultura)) res.push({ ty: "Зерно", t: z.kultura, s: T(z.ostatok_kg) + " т", h: "#zerno/" + encodeURIComponent(z.key) });
    z.po_firmam.forEach((f) => match(Q, f.firma, z.kultura) && !match(Q, z.kultura) && res.push({ ty: "Зерно · фирма", t: f.firma, s: `${z.kultura}: ${T(f.ostatok_kg)} т`, h: "#zerno/" + encodeURIComponent(z.key) }));
  });
  razn().forEach((x) => match(Q, x.pokupatel, x.produkt_name, x.nomer) && res.push({ ty: isK(x) ? "Комбикорм · хозяйство ТНК" : "Разнарядка" + (x.nomer ? " № " + x.nomer : ""), t: x.pokupatel, s: `${x.produkt_name} · остаток ${T(x.ostatok_kg)} т`, h: "#rz/" + encodeURIComponent(x.key) }));
  const seenK = new Set();
  razn().forEach((x) => { const k = kKey(x.pokupatel); if (!seenK.has(k) && match(Q, x.pokupatel)) { seenK.add(k); const l = kontrRows(x.pokupatel).filter((y) => y.status === "aktivnaya"); res.unshift({ ty: "Контрагент", t: x.pokupatel, s: `активных разнарядок: ${l.length} · остаток ${T(l.reduce((t, y) => t + y.ostatok_kg, 0))} т`, h: "#kontr/" + encodeURIComponent(x.pokupatel) }); } });
  staffSearch(res);
  tara().forEach((m) => match(Q, m.name, m.mesto, (m.dlya || []).join(" ")) && res.push({ ty: "Мешкотара · " + m.mesto, t: m.name, s: `${N(m.ostatok)} ${m.ed}` + (m.hvatit_dney != null ? " · " + daysTxt(m.hvatit_dney) : ""), h: "#tara/" + encodeURIComponent(m.key) }));
  return `<div class="note" style="font-weight:700">Найдено: ${res.length}</div>` + (res.length ? res.slice(0, 80).map(resRow).join("") : `<div class="empty">Ничего не найдено</div>`);
}
function resRow(r) {
  return `<button class="row" data-go="${r.h}" style="flex-direction:column;align-items:flex-start;gap:2px">
    <span style="font-size:11.5px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.4px">${esc(r.ty)}</span>
    <span class="n">${esc(r.t)}</span><span class="d num">${esc(r.s)}</span></button>`;
}

function prodRow(p) {
  let fs;
  if (p.rezerv_kg > 0 && p.svobodno_kg < 0) fs = `<span class="rs bad">не хватает ${W(-p.svobodno_kg)}</span>`;
  else if (p.rezerv_kg > 0) fs = `<span class="rs ok">свободно ${W(p.svobodno_kg)}</span>`;
  else fs = `<span class="rs" style="color:var(--muted)">без резерва</span>`;
  const places = Object.keys(p.po_mestam || {}).join(", ");
  return `<button class="row" data-go="#item/${encodeURIComponent(p.key)}">
    <span class="m"><span class="n">${esc(p.name)}</span><span class="d">${esc(places || "—")}</span></span>
    <span class="r num"><span class="rv">${W(p.ostatok_kg)}</span>${fs}</span></button>`;
}

function viewStock(chip) {
  if (!DATA) return { top: header("Остатки", "Поиск по остаткам"), main: noData() };
  chip = CHIPS.find((c) => c.id === chip) ? chip : "all";
  const chips = `<div class="chips scroll">${CHIPS.map((c) => `<button class="chip ${c.id === chip ? "on" : ""}" data-go="#stock/${c.id}">${c.label}</button>`).join("")}</div>`;
  if (chip === "gsm") return { top: header("Остатки · ГСМ и уголь", "Техника, водитель, назначение"), main: chips + viewGsmBody() };
  let body = "";
  const ph = chip === "zerno" ? "Культура или фирма" : chip === "tara" ? "Мешок, этикетка, продукция" : "Поиск по остаткам";
  if (chip === "zerno") {
    const list = zerno().filter((z) => match(Q, z.kultura, z.po_firmam.map((f) => f.firma).join(" ")));
    const tot = list.reduce((s, z) => s + z.ostatok_kg, 0);
    body = `<div class="total"><span>${Q ? "Найдено" : "Зерно на элеваторе"}</span><b class="num">${T(tot)} т</b></div>` +
      list.map((z) => `<button class="row" data-go="#zerno/${encodeURIComponent(z.key)}"><span class="m"><span class="n">${esc(z.kultura)}</span><span class="d">${z.po_firmam.length} ${plural(z.po_firmam.length, "фирма", "фирмы", "фирм")}</span></span><span class="r num"><span class="rv">${T(z.ostatok_kg)} т</span></span>${I.chev}</button>`).join("") +
      (list.length ? "" : `<div class="empty">Ничего не найдено</div>`);
  } else if (chip === "tara") {
    const work = tara().filter((m) => m.v_rabote && match(Q, m.name, m.mesto, (m.dlya || []).join(" ")))
      .sort((a, b) => (a.hvatit_dney == null ? 1e9 : a.hvatit_dney) - (b.hvatit_dney == null ? 1e9 : b.hvatit_dney));
    const rest = tara().filter((m) => !m.v_rabote);
    body = taraPodRazn() + `<div class="note">В работе — мешки и этикетки продукции, которая вырабатывалась за последние ${DATA.meta.nastroyki ? DATA.meta.nastroyki.v_rabote_dney : 30} дней или есть в активных разнарядках. Расход — по средней выработке фасовки.</div>` +
      work.map(taraRow).join("") + (work.length ? "" : `<div class="empty">Ничего не найдено</div>`) +
      `<button class="btn sec" data-go="#taraall">Подробнее: все остальные (${rest.length})</button>`;
  } else {
    const groups = chip === "all" ? GROUPS : GROUPS.filter((g) => g.id === chip);
    for (const g of groups) {
      const list = products().filter((p) => p.gruppa === g.g && match(Q, p.name));
      if (!list.length && chip === "all") continue;
      const tot = list.reduce((s, p) => s + p.ostatok_kg, 0);
      if (chip === "all") body += `<div class="h2" style="display:flex;justify-content:space-between"><span>${g.label}</span><span class="num">${T(tot)} т</span></div>`;
      else body += `<div class="total"><span>${Q ? "Найдено" : "Итого " + g.label.toLowerCase()}</span><b class="num">${T(tot)} т</b></div>`;
      body += list.map(prodRow).join("");
      if (!list.length) body += `<div class="empty">Ничего не найдено</div>`;
      if (g.id === "krupa" && !Q) body += krupaSyrie();
    }
    if (!body) body = `<div class="empty">Ничего не найдено</div>`;
  }
  return { top: header("Остатки", ph), main: chips + body };
}

function krupaSyrie() {
  const s = (DATA.ostatki.krupozavod_syrie || []).filter((x) => x.v_bunkere_kg || x.ne_zatareno_kg);
  if (!s.length) return "";
  return `<div class="h2">Крупозавод: сырьё и незатаренная продукция</div><div class="card kv">` +
    s.map((x) => `<div><span>${esc(x.syrie)}</span><b class="num">${x.v_bunkere_kg ? "в бункере " + W(x.v_bunkere_kg) : ""}${x.v_bunkere_kg && x.ne_zatareno_kg ? "<br>" : ""}${x.ne_zatareno_kg ? '<span class="warn">не затарено ' + W(x.ne_zatareno_kg) + "</span>" : ""}</b></div>`).join("") + `</div>`;
}

function prTxt(m) {
  if (!m.pod_razn_nuzhno) return "";
  const r = m.pod_razn_raznica;
  return `<span class="d num ${r < 0 ? "bad" : "ok"}" style="font-weight:800">под разнарядки: ${r < 0 ? "не хватает " + N(-r) : "излишек " + N(r)} ${esc(m.ed)}</span>`;
}
function taraRow(m) {
  return `<button class="row" data-go="#tara/${encodeURIComponent(m.key)}">
    <span class="m"><span class="n">${esc(m.name)}</span><span class="d num">${esc(m.mesto)} · ${N(m.ostatok)} ${esc(m.ed)}${m.rashod_v_sutki ? " · расход ~" + N(m.rashod_v_sutki) + "/сут" : ""}</span>${prTxt(m)}</span>
    <span class="r"><span class="badge ${daysCls(m.hvatit_dney)} num">${daysTxt(m.hvatit_dney)}</span></span></button>`;
}
function taraPodRazn() {
  const seen = new Set();
  const list = tara().filter((m) => m.pod_razn_nuzhno && match(Q, m.name, m.mesto, (m.dlya || []).join(" "))).filter((m) => {
    const k = (m.pod_razn_vmeste || [m.name]).join("|"); if (seen.has(k)) return false; seen.add(k); return true;
  }).sort((a, b) => a.pod_razn_raznica - b.pod_razn_raznica);
  if (!list.length) return "";
  const bad = list.filter((m) => m.pod_razn_raznica < 0).length;
  return `<div class="h2">Под разнарядки (надо вытарить)${bad ? " · не хватает " + bad : ""}</div>` + list.map((m) => {
    const r = m.pod_razn_raznica, nm = (m.pod_razn_vmeste || [m.name]).join(" + ");
    return `<button class="row" data-go="#tara/${encodeURIComponent(m.key)}" style="align-items:flex-start">
      <span class="m"><span class="n">${esc(nm)}</span><span class="d num">нужно ${N(m.pod_razn_nuzhno)} · есть ${N(m.pod_razn_ostatok)} ${esc(m.ed)}</span><span class="d">${esc((m.dlya || []).join(", "))}</span></span>
      <span class="r"><span class="badge ${r < 0 ? "b-bad" : "b-ok"} num">${r < 0 ? "не хватает " + N(-r) : "излишек " + N(r)}</span></span></button>`;
  }).join("") + `<div class="h2">Запас по дням (в работе)</div>`;
}

function viewTaraAll() {
  const rest = tara().filter((m) => !m.v_rabote && match(Q, m.name, m.mesto, (m.dlya || []).join(" ")));
  const places = [...new Set(rest.map((m) => m.mesto))];
  let body = `<div class="note">Продукция сейчас не вырабатывается — расход и «хватит на» для справки.</div>`;
  for (const pl of places) {
    body += `<div class="h2">${esc(pl)}</div>` + rest.filter((m) => m.mesto === pl).map(taraRow).join("");
  }
  if (!rest.length) body += `<div class="empty">Ничего не найдено</div>`;
  return { top: backbar("Мешкотара", "Все остальные позиции") + `<div style="padding:0 16px 8px">${searchBox("Мешок, этикетка")}</div>`, main: body };
}
function searchBox(ph) {
  return `<label class="search">${I.search}<input id="q" type="search" aria-label="Поиск" placeholder="${esc(ph)}" value="${esc(Q)}" autocomplete="off"><button class="iconbtn" id="qx" style="width:40px;height:40px;color:var(--muted);${Q ? "" : "display:none"}" aria-label="Очистить поиск" data-act="clearq">${I.x}</button></label>`;
}

function viewItem(key) {
  const p = byKey(products(), key);
  if (!p) return { top: backbar("Остатки", "Позиция"), main: `<div class="empty">Позиции нет в текущих данных</div>` };
  const rz = razn().filter((x) => x.produkt === key && x.status === "aktivnaya");
  const bags = tara().filter((m) => (m.dlya || []).includes(p.name));
  const fcls = p.svobodno_kg < 0 ? "bad" : "ok";
  const kb = p.gruppa === "Комбикорм";
  let main = `<div class="card big"><span class="l">Остаток всего</span><span class="v num">${W(p.ostatok_kg)}</span>
      ${p.ostatok_kg >= 67800 ? `<span class="note" style="padding:0">≈ ${nf1.format(p.ostatok_kg / 67800)} ваг. по 67,8 т</span>` : ""}</div>
    <div class="card kv">
      ${Object.entries(p.po_mestam || {}).map(([k, v]) => `<div><span>${esc(k)}</span><b class="num">${W(v)}</b></div>`).join("")}
      <div><span>${kb ? "Под потребность хозяйств" : "Резерв под разнарядки"}</span><b class="num">${W(p.rezerv_kg)}</b></div>
      <div><span>${p.svobodno_kg < 0 ? (kb ? "Не хватает (надо произвести)" : "Не хватает (надо вытарить)") : "Свободный остаток"}</span><b class="num ${fcls}">${W(Math.abs(p.svobodno_kg))}</b></div>
      ${p.fasovka_kg ? `<div><span>Фасовка</span><b class="num">${nf1.format(p.fasovka_kg).replace(",0", "")} кг</b></div>` : ""}
      <div><span>Группа</span><b>${esc(p.gruppa)}</b></div>
    </div>`;
  if (rz.length) main += `<div class="h2">${rz.every(isK) ? "Потребность хозяйств ТНК" : "Активные разнарядки"} · ${rz.length}</div>` + rz.map(rznRow).join("");
  if (bags.length) main += `<div class="h2">Мешкотара и этикетки</div>` + bags.map(taraRow).join("");
  return { top: backbar(p.gruppa, p.name), main };
}

function viewZerno(key) {
  const z = byKey(zerno(), key);
  if (!z) return { top: backbar("Зерно", "Культура"), main: `<div class="empty">Нет в текущих данных</div>` };
  const years = {};
  z.po_firmam.forEach((f) => Object.entries(f.po_godam).forEach(([y, v]) => { years[y] = (years[y] || 0) + v; }));
  const main = `<div class="card big"><span class="l">Всего на элеваторе</span><span class="v num">${T(z.ostatok_kg)} т</span></div>
    <div class="h2">По годам урожая</div>
    <div class="card kv">${Object.keys(years).sort().reverse().map((y) => `<div><span>Урожай ${y}</span><b class="num">${T(years[y])} т</b></div>`).join("")}</div>
    <div class="h2">По фирмам · ${z.po_firmam.length}</div>
    <div class="card">${z.po_firmam.map((f) => `<div class="firm" data-go="#kontr/${encodeURIComponent(f.firma)}" style="cursor:pointer"><div class="fh"><span>${esc(f.firma)} ›</span><span class="num">${T(f.ostatok_kg)} т</span></div>
      ${Object.keys(f.po_godam).length > 1 ? `<div class="fy">${Object.entries(f.po_godam).sort().reverse().map(([y, v]) => `<span class="badge b-mute num">${y}: ${T(v)} т</span>`).join("")}</div>` : `<div class="note" style="padding:2px 0 0">урожай ${Object.keys(f.po_godam)[0]}</div>`}</div>`).join("")}</div>`;
  return { top: backbar("Зерно на элеваторе", z.kultura), main };
}

function viewTara(key) {
  const m = byKey(tara(), key);
  if (!m) return { top: backbar("Мешкотара", "Позиция"), main: `<div class="empty">Нет в текущих данных</div>` };
  const prods = products().filter((p) => (m.dlya || []).includes(p.name));
  const main = `<div class="card big"><span class="l">Остаток</span><span class="v num">${N(m.ostatok)} ${esc(m.ed)}</span>
      <span><span class="badge ${daysCls(m.hvatit_dney)} num">${m.hvatit_dney != null ? "хватит на " + daysTxt(m.hvatit_dney) : "расхода нет"}</span></span></div>
    <div class="card kv">
      <div><span>Место</span><b>${esc(m.mesto)}</b></div>
      <div><span>Вид</span><b>${esc(m.vid)}</b></div>
      ${m.vagonov != null ? `<div><span>Хватит на вагонов</span><b class="num">${nf1.format(m.vagonov)}</b></div>` : ""}
      <div><span>Расход в сутки (средний)</span><b class="num">${m.rashod_v_sutki ? "~" + N(m.rashod_v_sutki) + " " + esc(m.ed) : "—"}</b></div>
      <div><span>Расход с начала месяца</span><b class="num">${N(m.rashod_s_nachala_mes)} ${esc(m.ed)}</b></div>
      <div><span>В работе</span><b>${m.v_rabote ? "да" : "нет"}</b></div>
      ${m.pod_razn_nuzhno ? `<div><span>Нужно под разнарядки${m.pod_razn_vmeste ? " (вместе: " + esc(m.pod_razn_vmeste.join(" + ")) + ")" : ""}</span><b class="num">${N(m.pod_razn_nuzhno)} ${esc(m.ed)}</b></div>
      <div><span>${m.pod_razn_raznica < 0 ? "Не хватает" : "Излишек"} под разнарядки</span><b class="num ${m.pod_razn_raznica < 0 ? "bad" : "ok"}">${N(Math.abs(m.pod_razn_raznica))} ${esc(m.ed)}</b></div>` : ""}
    </div>
    ${(m.dlya || []).length ? `<div class="h2">Для продукции</div>` + (prods.length ? prods.map(prodRow).join("") : `<div class="card kv">${m.dlya.map((d) => `<div><span>${esc(d)}</span><b></b></div>`).join("")}</div>`) : ""}
    <div class="note">Расход = средняя выработка этой фасовки за ${DATA.meta.nastroyki ? DATA.meta.nastroyki.period_sredney_dney : 90} дней (в дни работы) ÷ вес мешка. Это оценка «если линия работает на этом мешке».</div>`;
  return { top: backbar("Мешкотара · " + m.mesto, m.name), main };
}

const RZF = [{ id: "active", label: "Активные" }, { id: "done", label: "Выполненные" }, { id: "all", label: "Все" }, { id: "kombi", label: "Комбикорм ТНК" }];
function rznRow(x) {
  const k = isK(x);
  const st = x.status === "aktivnaya" ? `<span class="badge b-info">${k ? "к отгрузке" : "активная"}</span>`
    : x.status === "zakryta" ? `<span class="badge b-warn">закрыта с остатком</span>` : `<span class="badge b-ok">${k ? "отгружено" : "выполнена"}</span>`;
  const head = k ? `<span class="badge b-mute">${esc((x.pometka || "потребность").replace(/^Потребность/i, "потребность"))}</span>`
    : `<span class="num" style="font-size:12px;font-weight:800;color:var(--muted)">${x.nomer ? "№ " + esc(x.nomer) : "без номера"}</span>`;
  const right = !k && x.vagonov != null ? `<span class="num" style="margin-left:auto;font-size:12px;color:var(--muted)">${nf1.format(x.vagonov)} ваг.</span>` : "";
  return `<button class="row" data-go="#rz/${encodeURIComponent(x.key)}" style="flex-direction:column;align-items:stretch;gap:8px;padding:14px">
    <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${head}${st}${!k && x.pometka ? `<span class="badge b-warn">${esc(x.pometka)}</span>` : ""}${right}</span>
    <span><span class="n" style="font-size:15px">${esc(x.pokupatel)}</span><span class="d">${esc(x.produkt_name)}</span></span>
    <span class="grid3 num"><span>${k ? "Потребность" : "Всего"}<br><b>${T(x.obem_kg)}</b></span><span>Отгружено<br><b>${T(x.otgruzheno_kg)}</b></span><span>Остаток<br><b>${T(x.ostatok_kg)}</b></span></span>
    <span class="bar"><i style="width:${Math.min(100, x.procent)}%"></i></span>
    <span class="num" style="font-size:12px;color:var(--muted)">отгружено ${nf1.format(x.procent)}% · тонны${x.snyata ? " · снята из свода " + esc(x.snyata) : ""}</span></button>`;
}

function viewRazn(f) {
  if (!DATA) return { top: header("Разнарядки", "Покупатель, продукция, номер"), main: noData() };
  f = RZF.find((z) => z.id === f) ? f : "active";
  const list = razn().filter((x) => (f === "kombi" ? isK(x) : !isK(x) && (f === "all" || (f === "active" ? x.status === "aktivnaya" : x.status !== "aktivnaya"))) && match(Q, x.pokupatel, x.produkt_name, x.nomer, x.pometka));
  const tot = list.reduce((s, x) => s + x.obem_kg, 0), done = list.reduce((s, x) => s + x.otgruzheno_kg, 0), rest = list.reduce((s, x) => s + (x.status === "zakryta" ? 0 : x.ostatok_kg), 0);
  const pct = tot ? done / tot * 100 : 0;
  const chips = `<div class="chips scroll">${RZF.map((c) => `<button class="chip ${c.id === f ? "on" : ""}" data-go="#razn/${c.id}">${c.label}</button>`).join("")}</div>`;
  const sum = `<div style="padding:14px 16px;border-radius:18px;background:var(--accentSoft);display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;justify-content:space-between;font-weight:800;color:var(--accent)"><span>${list.length} ${plural(list.length, "строка", "строки", "строк")}</span><span class="num">${nf1.format(pct)}%</span></div>
    <div class="bar" style="background:var(--surface)"><i style="width:${Math.min(100, pct)}%"></i></div>
    <div class="grid3 num" style="font-size:12px"><span>${f === "kombi" ? "Потребность" : "Всего"}<br><b>${T(tot)} т</b></span><span>Отгружено<br><b>${T(done)} т</b></span><span>Остаток<br><b>${T(rest)} т</b></span></div></div>`;
  if (f === "kombi") {
    const kv = DATA.razn.kombikorm_kvota;
    const body = (kv && kv.pozicii ? kvotaCard(kv) : "") + syrieCard(DATA.razn.kombikorm_syrie) + `<div class="h2">По хозяйствам</div>` + list.map(rznRow).join("") + (list.length ? "" : `<div class="empty">Ничего не найдено</div>`);
    return { top: header("Разнарядки", "Хозяйство или вид комбикорма"), main: chips + sum + body };
  }
  const note = f === "done" && !list.length && !Q ? `<div class="empty">Завершённых пока нет. Разнарядка попадает сюда, когда её убирают из свода: сборщик помнит прошлую сборку.</div>` : (!list.length ? `<div class="empty">Ничего не найдено</div>` : "");
  return { top: header("Разнарядки", "Покупатель, продукция, номер"), main: chips + sum + list.map(rznRow).join("") + note };
}

function syrieCard(sy) {
  if (!sy || Q) return "";
  const pr = sy.proizvesti.filter((x) => x.proizvesti_kg > 0);
  const need = sy.komponenty.filter((z) => z.nuzhno_kg > 0);
  const other = sy.komponenty.filter((z) => z.nuzhno_kg <= 0 && z.ostatok_kg > 0);
  const lack = need.filter((z) => z.raznica_kg < 0).length;
  let h = `<div class="h2">Произвести ещё (к отгрузке − на складе)</div><div class="card kv">` +
    (pr.length ? pr.map((x) => `<div><span>${esc(x.name)}${x.est_recept ? "" : ' <span class="warn">· нет рецепта</span>'}</span><b class="num">${T(x.proizvesti_kg)} т</b></div>`).join("") : `<div><span>Всё есть на складе</span><b></b></div>`) + `</div>`;
  h += `<div class="h2">Сырьё под потребность${lack ? ` · не хватает ${lack}` : ""}</div>`;
  h += need.map((z) => {
    const bad = z.raznica_kg < 0;
    return `<div class="row" style="align-items:flex-start">
      <span class="m"><span class="n">${esc(z.name)}</span><span class="d num">нужно ${T(z.nuzhno_kg)} т · на складе ${T(z.ostatok_kg)} т</span>${z.dlya.length ? `<span class="d">${esc(z.dlya.join(", "))}</span>` : ""}</span>
      <span class="r"><span class="badge ${bad ? "b-bad" : "b-ok"} num">${bad ? "не хватает " + T(-z.raznica_kg) : "излишек " + T(z.raznica_kg)} т</span></span></div>`;
  }).join("");
  if (other.length) h += `<div class="h2">Сырьё на складе, не нужное под текущую потребность</div><div class="card kv">` +
    other.map((z) => `<div><span>${esc(z.name)}</span><b class="num">${T(z.ostatok_kg)} т</b></div>`).join("") + `</div>`;
  h += `<div class="note">Нужно = (потребность хозяйств − отгружено − готовый комбикорм на складе) × норма рецепта, без потерь. Рецепты — файл «Рецепты_комбикорма» в папке на ПК.</div>`;
  return h;
}

function kvotaCard(kv) {
  const rows = kv.pozicii.filter((q) => q.zayavleno || q.proizvedeno || q.zayavleno_god || q.proizvedeno_god);
  if (!rows.length) return "";
  const pc = (a, b) => (b ? nf0.format(a / b * 100) + "%" : "—");
  return `<div class="h2">${esc(kv.period || "Квота комбикорма")}</div>
    <div class="card kv">${rows.map((q) => `<div style="flex-direction:column;gap:2px;${q.itogo ? "font-weight:800" : ""}">
      <span style="color:var(--text);font-weight:${q.itogo ? 800 : 700}">${esc(q.name)}</span>
      <span class="num" style="display:flex;justify-content:space-between;gap:8px"><span>заявлено ${T(q.zayavleno)} т · произведено ${T(q.proizvedeno)} т</span><b>${pc(q.proizvedeno, q.zayavleno)}</b></span>
      ${q.zayavleno_god ? `<span class="num" style="font-size:12px">с начала года: ${T(q.proizvedeno_god)} из ${T(q.zayavleno_god)} т (${pc(q.proizvedeno_god, q.zayavleno_god)})</span>` : ""}</div>`).join("")}</div>`;
}

function viewRz(key) {
  const x = byKey(razn(), key);
  if (!x) return { top: backbar("Разнарядка", ""), main: `<div class="empty">Нет в текущих данных</div>` };
  const p = byKey(products(), x.produkt);
  const main = `<div style="padding:14px 16px;border-radius:18px;background:var(--accentSoft);display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;font-weight:800;color:var(--accent)"><span>${x.status === "aktivnaya" ? (isK(x) ? "К отгрузке" : "Активная") : x.status === "zakryta" ? "Закрыта с остатком" : (isK(x) ? "Отгружено полностью" : "Выполнена")}</span><span class="num">${nf1.format(x.procent)}%</span></div>
      <div class="bar" style="background:var(--surface)"><i style="width:${Math.min(100, x.procent)}%"></i></div>
      <div class="grid3 num" style="font-size:12px"><span>${isK(x) ? "Потребность" : "Всего"}<br><b>${T(x.obem_kg)} т</b></span><span>Отгружено<br><b>${T(x.otgruzheno_kg)} т</b></span><span>Остаток<br><b>${T(x.ostatok_kg)} т</b></span></div></div>
    <div class="card kv">
      ${isK(x) ? "" : `<div><span>Номер</span><b>${x.nomer ? esc(x.nomer) : "без номера"}</b></div>`}
      <div><span>${isK(x) ? "Хозяйство ТНК" : "Покупатель"}</span><b>${kontrLink(x.pokupatel)}</b></div>
      <div><span>Продукция</span><b>${esc(x.produkt_name)}</b></div>
      ${x.vagonov != null ? `<div><span>Остаток, вагонов</span><b class="num">${nf1.format(x.vagonov)}</b></div>` : ""}
      ${x.pometka ? `<div><span>${isK(x) ? "Период" : "Пометка"}</span><b class="${isK(x) ? "" : "warn"}">${esc(x.pometka)}</b></div>` : ""}
      ${x.snyata ? `<div><span>Убрана из свода</span><b>${esc(x.snyata)}</b></div>
      <div><span>Остаток в последнем своде${x.posl_data ? " (" + esc(x.posl_data) + ")" : ""}</span><b class="num">${T(x.posl_ostatok_kg)} т</b></div>` : ""}
    </div>
    ${x.snyata ? `<div class="note">${x.status === "zakryta" ? "Строку убрали из свода с заметным остатком — возможно, отменили или перенесли." : "Остаток был не больше вагона — считаю отгруженной полностью."}</div>` : ""}
    ${p ? `<div class="h2">Остаток продукции</div>` + prodRow(p) : ""}`;
  return { top: backbar(isK(x) ? "Комбикорм · хозяйство ТНК" : "Разнарядка" + (x.nomer ? " № " + x.nomer : ""), x.pokupatel), main };
}


/* ───── карточка контрагента: все его разнарядки и зерно на элеваторе ───── */
function kKey(s) { return low(s).replace(/[«»"'“”.,]/g, " ").replace(/\b(тоо|ао|ип|кх|кфх|пк|оао|зао)\b/g, " ").replace(/\s+/g, " ").trim(); }
function kontrRows(name) { const k = kKey(name); return razn().filter((x) => kKey(x.pokupatel) === k); }
function kontrZerno(name) {
  const k = kKey(name), out = [];
  if (k.length < 3) return out;
  zerno().forEach((z) => z.po_firmam.forEach((f) => { const fk = kKey(f.firma); if (fk === k || fk.includes(k) || k.includes(fk)) out.push({ z, f }); }));
  return out;
}
function kontrLink(name) { return `<button class="ok" style="font-weight:800;text-align:right" data-go="#kontr/${encodeURIComponent(name)}">${esc(name)} ›</button>`; }
function viewKontr(name) {
  const rows = kontrRows(name), zr = kontrZerno(name);
  if (!rows.length && !zr.length) return { top: backbar("Контрагент", name), main: `<div class="empty">Нет в текущих данных</div>` };
  const act = rows.filter((x) => x.status === "aktivnaya"), done = rows.filter((x) => x.status !== "aktivnaya");
  const s = (l, k) => l.reduce((t, x) => t + (x[k] || 0), 0);
  let main = "";
  if (rows.length) {
    const pr = s(act, "obem_kg") ? s(act, "otgruzheno_kg") / s(act, "obem_kg") * 100 : 0;
    main += `<div style="padding:14px 16px;border-radius:18px;background:var(--accentSoft);display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;font-weight:800;color:var(--accent)"><span>Активных разнарядок: ${act.length}${done.length ? " · выполненных: " + done.length : ""}</span><span class="num">${nf1.format(pr)}%</span></div>
      <div class="bar" style="background:var(--surface)"><i style="width:${Math.min(100, pr)}%"></i></div>
      <div class="grid3 num" style="font-size:12px"><span>Всего<br><b>${T(s(act, "obem_kg"))} т</b></span><span>Отгружено<br><b>${T(s(act, "otgruzheno_kg"))} т</b></span><span>Остаток<br><b>${T(s(act, "ostatok_kg"))} т</b></span></div></div>`;
    const byP = {};
    act.forEach((x) => { const p = byP[x.produkt] = byP[x.produkt] || { name: x.produkt_name, key: x.produkt, ost: 0 }; p.ost += x.ostatok_kg; });
    const pl = Object.values(byP).filter((p) => p.ost > 0).sort((a, b) => b.ost - a.ost);
    if (pl.length) main += `<div class="h2">К отгрузке по продукции</div><div class="card kv">${pl.map((p) => {
      const st = byKey(products(), p.key);
      const hint = st ? (st.ostatok_kg >= p.ost ? `<span class="ok">на складе ${T(st.ostatok_kg)} т</span>` : `<span class="bad">на складе ${T(st.ostatok_kg)} т</span>`) : "";
      return `<div><span>${esc(p.name)}${hint ? "<br><small>" + hint + "</small>" : ""}</span><b class="num">${T(p.ost)} т</b></div>`;
    }).join("")}</div>`;
    if (act.length) main += `<div class="h2">Активные · ${act.length}</div>` + act.map(rznRow).join("");
    if (done.length) main += `<div class="h2">Выполненные · ${done.length}</div>` + done.map(rznRow).join("");
  }
  if (zr.length) {
    main += `<div class="h2">Зерно на элеваторе · ${T(zr.reduce((t, x) => t + x.f.ostatok_kg, 0))} т</div><div class="card">${zr.map(({ z, f }) =>
      `<button class="firm" style="width:100%;text-align:left" data-go="#zerno/${encodeURIComponent(z.key)}"><div class="fh"><span>${esc(z.kultura)}</span><span class="num">${T(f.ostatok_kg)} т</span></div>
       <div class="note" style="padding:2px 0 0">${esc(f.firma)}${Object.keys(f.po_godam).length ? " · урожай " + Object.keys(f.po_godam).sort().join(", ") : ""}</div></button>`).join("")}</div>`;
  }
  return { top: backbar(rows.length && rows.every(isK) ? "Хозяйство ТНК" : "Контрагент", name), main };
}

function viewSoon(title, stage, what) {
  return { top: header(title, "Поиск"), main: `<div class="card big" style="gap:8px"><div style="font-size:17px;font-weight:800">${esc(title)} — ${esc(stage)}</div><div class="note" style="padding:0">${esc(what)}</div></div>` };
}

function viewMore() {
  const items = [
    { t: "Загрузить данные", s: (DATA ? "сейчас: на " + DATA.meta.data_na_utro : "данных пока нет") + (typeof SYNC !== "undefined" && SYNC && SYNC.ek ? " · автообновление включено" : ""), h: "#load" },
    { t: "Выработка", s: V() ? "по подразделениям, данные по " + V().po : "нет в архиве", h: "#vyr" },
    { t: "Штатное расписание", s: P() && P().shtat ? "на " + P().shtat.data + " · окладники, сдельщики, вакансии" : "нет в архиве", h: "#shtat/okl" },
    { t: "О данных", s: "даты источников, предупреждения сборщика", h: "#about" },
    { t: "Настройки", s: "тема, порог дней для мешкотары", h: "#settings" }
  ];
  return {
    top: backbar("Справочник экономиста", "Ещё"),
    main: items.map((i) => `<button class="row" data-go="${i.h}"><span class="m"><span class="n">${i.t}</span><span class="d">${esc(i.s)}</span></span>${I.chev}</button>`).join("") +
      `<div class="note">Тарифы, заметки, заявки — следующие шаги. Версия приложения ${APP_VERSION}.</div>`
  };
}

function envTxt() {
  const ua = navigator.userAgent;
  const br = /SamsungBrowser/.test(ua) ? "Samsung Internet" : /EdgA|YaBrowser|OPR|Firefox/.test(ua) ? "другой браузер" : /Chrome\//.test(ua) ? "Chrome" : "другой браузер";
  let st = "во вкладке браузера";
  try { if (matchMedia("(display-mode: standalone)").matches) st = "как установленное приложение"; } catch (e) { /* */ }
  return br + " · " + st;
}
function viewLoad() {
  return {
    top: backbar("Ещё", "Загрузить данные"),
    main: `<div class="card big" style="gap:10px">
      <div style="font-weight:800;font-size:16px">${DATA ? "Сейчас: данные на " + esc(DATA.meta.data_na_utro) : "Данных пока нет"}</div>
      ${DATA ? `<div class="note" style="padding:0">Загружено ${esc(DATA.loadedAt)} из ${esc(DATA.fileName || "архива")}</div>` : ""}
      <button class="btn" data-act="pick">${I.upload} Выбрать архив</button>
    </div>
    ${syncCard()}
    <div class="h2">Как обновить</div>
    <div class="card kv">
      <div><span>1. На ПК</span><b>«Собрать_для_телефона» → кнопка</b></div>
      <div><span>2. Сборщик сам</span><b>отправляет архив в Telegram-бот</b></div>
      <div><span>3. Telegram на телефоне</span><b>файл от бота → ⋮ → «Поделиться» → «Справочник»</b></div>
      <div><span>Или вручную</span><b>«Выбрать архив» → Загрузки → Telegram</b></div>
    </div>
    <div class="note">Данные хранятся только в этом телефоне и в интернет не отправляются.</div>
    <div class="note">Открыто: ${esc(envTxt())} · версия ${APP_VERSION}</div>`
  };
}

function viewAbout() {
  if (!DATA) return { top: backbar("Ещё", "О данных"), main: noData() };
  const m = DATA.meta;
  const main = `<div class="card kv">
      <div><span>Данные на утро</span><b class="num">${esc(m.data_na_utro)}</b></div>
      <div><span>Собрано на ПК</span><b class="num">${esc(m.sobrano)}</b></div>
      <div><span>Загружено в телефон</span><b class="num">${esc(DATA.loadedAt)}</b></div>
      <div><span>Версия сборщика</span><b>${esc(m.versiya_sborshika)}</b></div>
    </div>
    <div class="h2">Источники</div>
    <div class="card kv">${Object.entries(m.istochniki || {}).map(([k, v]) => `<div><span>${esc(k)}</span><b class="num ${v !== m.data_na_utro ? "warn" : ""}">${esc(v || "нет файла")}</b></div>`).join("")}</div>
    <div class="h2">Предупреждения сборщика · ${(m.preduprezhdeniya || []).length}</div>
    ${(m.preduprezhdeniya || []).length ? m.preduprezhdeniya.map((w) => `<div class="alert"><span class="warn">${I.warn}</span><span class="a2" style="color:var(--text)">${esc(w)}</span></div>`).join("") : `<div class="card empty" style="padding:16px">Нет</div>`}`;
  return { top: backbar("Ещё", "О данных"), main };
}

function viewSettings() {
  const th = [["auto", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]];
  const pr = [7, 10, 15, 20, 30];
  return {
    top: backbar("Ещё", "Настройки"),
    main: `<div class="h2">Тема</div><div class="seg">${th.map(([k, l]) => `<button class="${SET.theme === k ? "on" : ""}" data-settheme="${k}">${l}</button>`).join("")}</div>
      <div class="h2">Мешкотара: предупреждать, если хватит меньше чем на</div>
      <div class="seg">${pr.map((p) => `<button class="num ${SET.porog === p ? "on" : ""}" data-porog="${p}">${p} дн.</button>`).join("")}</div>
      <div class="h2">Память</div>
      <button class="btn sec" data-act="wipe">Удалить данные из телефона</button>`
  };
}

/* ───────── отрисовка ───────── */
function render(mainOnly) {
  const r = route();
  const key = r.a + "/" + r.b.split("/")[0];
  if (key !== lastRoute) { Q = ""; lastRoute = key; }
  if (pendingQ != null) { Q = pendingQ; pendingQ = null; }
  let v;
  switch (r.a) {
    case "stock": v = viewStock(r.b); break;
    case "item": v = viewItem(r.b); break;
    case "zerno": v = viewZerno(r.b); break;
    case "tara": v = viewTara(r.b); break;
    case "taraall": v = viewTaraAll(); break;
    case "razn": v = viewRazn(r.b); break;
    case "rz": v = viewRz(r.b); break;
    case "kontr": v = viewKontr(r.b); break;
    case "staff": v = viewStaff(r.b); break;
    case "emp": v = viewEmp(r.b); break;
    case "dep": v = viewDep(r.b); break;
    case "req": v = viewSoon("Заявки", "этап 3", "Заявки на закуп и оплату из реестра Word, поиск по позиции и поставщику."); break;
    case "more": v = viewMore(); break;
    case "load": v = viewLoad(); break;
    case "about": v = viewAbout(); break;
    case "settings": v = viewSettings(); break;
    case "shtat": v = viewShtat(r.b); break;
    case "vyr": v = viewVyr(); break;
    case "vyrd": v = viewVyrD(r.b); break;
    default: v = viewHome();
  }
  document.getElementById("main").innerHTML = v.main;
  if (mainOnly) return;
  document.getElementById("top").innerHTML = v.top;
  renderNav(r);
  const on = document.querySelector(".chip.on");
  if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
}

function rerenderKeepFocus() {
  const pos = document.getElementById("q") ? document.getElementById("q").selectionStart : null;
  render();
  const q = document.getElementById("q");
  if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) { /* */ } }
}

let toastTimer;
function toast(t) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = t; el.style.display = "block";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = "none"; }, 3500);
}

/* ───────── события ───────── */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-go],[data-act],[data-settheme],[data-porog],[data-grp]");
  if (!b) return;
  if (b.dataset.grp) { const g = b.dataset.grp; if (openGroups.has(g)) openGroups.delete(g); else openGroups.add(g); render(true); return; }
  if (b.dataset.go) { go(b.dataset.go); return; }
  if (b.dataset.settheme) { SET.theme = b.dataset.settheme; lsSet(LS_SET, SET); applyTheme(); render(); return; }
  if (b.dataset.porog) { SET.porog = +b.dataset.porog; lsSet(LS_SET, SET); render(); return; }
  const a = b.dataset.act;
  if (a === "theme") { SET.theme = isDark() ? "light" : "dark"; lsSet(LS_SET, SET); applyTheme(); render(); }

  else if (a === "clearq") { Q = ""; rerenderKeepFocus(); }
  else if (a === "back") { if (history.length > 1) history.back(); else go("#home"); }
  else if (a === "pick") { document.getElementById("file").click(); }
  else if (a === "force") { if (pending) { saveData(pending); pending = null; toast("Загружено"); go("#home"); } }
  else if (a === "wipe") {
    if (b.dataset.sure) { try { localStorage.removeItem(LS_DATA); } catch (er) { /* */ } DATA = null; zpLock(); toast("Данные удалены"); go("#home"); }
    else { b.dataset.sure = "1"; b.textContent = "Точно удалить? Нажмите ещё раз"; }
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id !== "q") return;
  Q = e.target.value;
  render(true);   // обновляем только список, поле поиска не трогаем — клавиатура не мигает
  const x = document.getElementById("qx");
  if (x) x.style.display = Q ? "" : "none";
});

let pending = null;
document.getElementById("file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) handleArchive(f);
});

// архив, присланный через «Поделиться → Справочник»
async function takeShared() {
  if (location.hash !== "#share") return;
  history.replaceState(null, "", "#home");
  render();
  try {
    const c = await caches.open("share-inbox");
    const r = await c.match("/__spr_shared_archive__");
    if (!r) { toast("Файл не получен — попробуйте ещё раз или «Ещё → Загрузить данные»"); return; }
    const blob = await r.blob();
    const name = decodeURIComponent(r.headers.get("X-Name") || "архив.zip");
    await c.delete("/__spr_shared_archive__");
    await handleArchive(new File([blob], name));
  } catch (err) { toast("Не получилось: " + err.message); }
}

async function handleArchive(f) {
  try {
    const res = await loadArchive(f, false);
    if (res.older) {
      pending = res.d;
      document.getElementById("main").insertAdjacentHTML("afterbegin",
        `<div class="alert bad"><span class="bad">${I.warn}</span><span style="flex:1"><span class="a1">Этот архив старше текущих данных</span><span class="a2">в архиве на ${esc(res.d.meta.data_na_utro)}, сейчас на ${esc(DATA.meta.data_na_utro)}</span>
        <button class="btn sec" style="margin-top:8px;height:44px" data-act="force">Всё равно загрузить</button></span></div>`);
      return;
    }
    saveData(res.d);
    const w = (res.d.meta.preduprezhdeniya || []).length;
    toast("Загружено: данные на " + res.d.meta.data_na_utro + (w ? " · предупреждений: " + w : ""));
    go("#home");
  } catch (err) {
    toast("Не получилось: " + err.message);
  }
}

if (window.matchMedia) {
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (SET.theme === "auto") { applyTheme(); render(); } }); } catch (e) { /* */ }
}

applyTheme();
syncTakeSetup();
if (location.hash === "#share") takeShared(); else render();
setTimeout(() => syncNow(true), 800);

if ("serviceWorker" in navigator) {
  // при выходе новой версии — один раз перезагрузиться, чтобы сразу открылась она
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").then((r) => r.update()).catch(() => { /* */ }); });
}
