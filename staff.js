/* Справочник экономиста — раздел «Персонал» (этап 4): сотрудники, табель, приказы, зарплата под PIN. */
"use strict";

const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MON_S = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const ABS = { "о": ["Отпуск", "b-info"], "б/л": ["Больничный", "b-bad"], "б/с": ["Без сохранения", "b-warn"], "д/о": ["Декрет", "b-mute"], "у/р": ["Уход за ребёнком", "b-mute"], "н": ["Отсутствие", "b-bad"] };
const ZPK = [["ok", "Оклад"], ["ch", "Почасовая оплата"], ["sd", "Сдельная"], ["dp", "Доплата за совмещение"], ["pr", "Премии"], ["no", "Ночные"], ["ot", "Отпускные"], ["bl", "Больничные"], ["ko", "Компенсация за отпуск (при увольнении)"], ["pc", "Прочее"]];
const LOCK_MS = 5 * 60 * 1000;

let ZP = null;            // расшифрованная зарплата — только в памяти, пока открыто
let zpTimer = null;
let staffChip = "all";
const PER = { t: { k: "m" }, z: { k: "y" }, d: { k: "m" } };

function P() { return DATA && DATA.pers ? DATA.pers : null; }
function people() { return P() && P().personal ? P().personal.sotrudniki : []; }
function emp(tab) { return people().find((x) => x.tab === tab); }
function mLabel(k, short) { const [y, m] = k.split("-"); return (short ? MON_S : MON)[+m - 1] + " " + (short ? y.slice(2) : y); }
function money(x) { return nf0.format(Math.round(x || 0)); }
function stBadge(s) {
  if (!s) return "";
  if (s.uvolen) return `<span class="badge b-mute">Уволен</span>`;
  const st = s.status;
  if (!st) return "";
  if (st.kod === "у") return `<span class="badge b-mute">Уволен</span>`;
  const a = ABS[st.kod];
  return a ? `<span class="badge ${a[1]}">${a[0]}</span>` : "";
}
function isAbsent(s) { return !s.uvolen && s.status && ABS[s.status.kod]; }

/* ───── период ───── */
function quarterOf(k) { return k.slice(0, 4) + "-Q" + Math.ceil(+k.slice(5) / 3); }
function resolvePer(st, months) {
  if (!months.length) return [];
  const last = months[months.length - 1];
  if (st.k === "m") return [months.includes(st.m) ? st.m : last];
  if (st.k === "q") { const q = st.q || quarterOf(last); return months.filter((m) => quarterOf(m) === q); }
  if (st.k === "y") { const y = last.slice(0, 4); return months.filter((m) => m.startsWith(y)); }
  const a = st.a && months.includes(st.a) ? st.a : months[0], b = st.b && months.includes(st.b) ? st.b : last;
  return months.filter((m) => m >= (a < b ? a : b) && m <= (a < b ? b : a));
}
function perPicker(id, months) {
  const st = PER[id];
  const sel = resolvePer(st, months);
  const kinds = [["m", "Месяц"], ["q", "Квартал"], ["y", "С начала года"], ["c", "Свой"]];
  let h = `<div class="seg">${kinds.map(([k, l]) => `<button class="${st.k === k ? "on" : ""}" data-per="${id}:k:${k}">${l}</button>`).join("")}</div>`;
  if (st.k === "m") {
    const cur = sel[0];
    h += `<div class="chips scroll">${months.slice().reverse().map((m) => `<button class="chip ${m === cur ? "on" : ""}" data-per="${id}:m:${m}">${mLabel(m, true)}</button>`).join("")}</div>`;
  } else if (st.k === "q") {
    const qs = [...new Set(months.map(quarterOf))].reverse(), cur = st.q || qs[0];
    h += `<div class="chips scroll">${qs.map((q) => `<button class="chip ${q === cur ? "on" : ""}" data-per="${id}:q:${q}">${q.slice(-1)} кв. ${q.slice(0, 4)}</button>`).join("")}</div>`;
  } else if (st.k === "c") {
    const opt = (v) => months.map((m) => `<option value="${m}" ${m === v ? "selected" : ""}>${mLabel(m)}</option>`).join("");
    h += `<div class="pp"><label>с <select data-pers="${id}:a">${opt(sel[0])}</select></label><label>по <select data-pers="${id}:b">${opt(sel[sel.length - 1])}</select></label></div>`;
  }
  return { html: h, sel };
}
function perText(sel) { return !sel.length ? "" : sel.length === 1 ? mLabel(sel[0]) : mLabel(sel[0]) + " — " + mLabel(sel[sel.length - 1]); }

/* ───── табель ───── */
function tabelStat(tab, sel) {
  const T = P().tabel, lim = parseRu(T.po);
  const out = { dn: 0, h: 0, abs: {}, norm: [0, 0], months: [], partial: false };
  sel.forEach((k) => {
    const cells = (T.ludi[tab] || {})[k];
    const [y, m] = k.split("-").map(Number);
    const r = { k, dn: 0, h: 0, abs: {} };
    if (cells) {
      cells.forEach((c, i) => {
        const d = new Date(y, m - 1, i + 1);
        if (lim && d > lim) { out.partial = true; return; }
        if (typeof c === "number") { if (c > 0) { r.dn++; r.h += c; } } else if (c && ABS[c]) r.abs[c] = (r.abs[c] || 0) + 1;
      });
    }
    const nm = T.norma[k] || [0, 0];
    r.norm = nm; r.has = !!cells;
    out.months.push(r);
    out.dn += r.dn; out.h += r.h; out.norm[0] += nm[0]; out.norm[1] += nm[1];
    Object.entries(r.abs).forEach(([c, n]) => { out.abs[c] = (out.abs[c] || 0) + n; });
  });
  const absD = Object.values(out.abs).reduce((s, n) => s + n, 0);
  out.yavka = out.dn + absD ? Math.round(out.dn / (out.dn + absD) * 100) : null;
  return out;
}
function calStrip(tab, k) {
  const cells = (P().tabel.ludi[tab] || {})[k];
  if (!cells) return "";
  const [y, m] = k.split("-").map(Number), lim = parseRu(P().tabel.po);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  let h = `<div class="cal">${["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => `<span class="cw">${d}</span>`).join("")}`;
  for (let i = 0; i < first; i++) h += `<span></span>`;
  cells.forEach((c, i) => {
    const fut = lim && new Date(y, m - 1, i + 1) > lim;
    let cls = "c0", t = "";
    if (typeof c === "number") { cls = "cw1"; t = nf0.format(c); }
    else if (c === "в") { cls = "cv"; t = "в"; }
    else if (c && ABS[c]) { cls = "c-" + ABS[c][1]; t = c; }
    else if (c) { cls = "cv"; t = c; }
    h += `<span class="cd ${cls} ${fut ? "fut" : ""}"><i>${i + 1}</i>${esc(t)}</span>`;
  });
  return h + `</div>`;
}

/* ───── зарплата: расшифровка ───── */
function b64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
async function zpDecrypt(z, pin) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64(z.salt), iterations: z.iter }, base, 512));
  const iv = b64(z.iv), ct = b64(z.ct);
  const mk = await crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const msg = new Uint8Array(iv.length + ct.length); msg.set(iv); msg.set(ct, iv.length);
  if (!(await crypto.subtle.verify("HMAC", mk, b64(z.mac), msg))) return null;
  const ak = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-CTR", false, ["decrypt"]);
  const raw = await crypto.subtle.decrypt({ name: "AES-CTR", counter: iv, length: 128 }, ak, ct);
  const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate"));
  return JSON.parse(await new Response(ds).text());
}
function zpLock() { ZP = null; clearTimeout(zpTimer); }
function zpTouch() { if (ZP) { clearTimeout(zpTimer); zpTimer = setTimeout(() => { zpLock(); render(); }, LOCK_MS); } }
document.addEventListener("visibilitychange", () => { if (document.hidden && ZP) { zpLock(); render(); } });
["click", "touchstart", "input"].forEach((ev) => document.addEventListener(ev, zpTouch, { passive: true }));

function lockCard(what) {
  if (!P() || !P().zarplata) return `<div class="card empty">Зарплаты в архиве нет — на ПК не задан PIN или нет расчётных ведомостей.</div>`;
  return `<div class="card big lock">
    <div style="font-size:16px;font-weight:800">${esc(what)} — под PIN-кодом</div>
    <div class="note" style="padding:0">Тот же PIN, что вводился в сборщике на ПК. Закроется через 5 минут без действий и при сворачивании.</div>
    <input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN" aria-label="PIN-код">
    <button class="btn" data-unlock="1">Открыть</button>
    <div id="pinerr" class="bad" style="font-weight:700;min-height:18px"></div>
  </div>`;
}
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "pin") unlock(); });
async function unlock() {
  const pin = (document.getElementById("pin").value || "").trim();
  const err = document.getElementById("pinerr");
  if (!/^\d{4,6}$/.test(pin)) { err.textContent = "Нужно 4–6 цифр"; return; }
  err.textContent = "Проверяю…";
  try {
    const d = await zpDecrypt(P().zarplata, pin);
    if (!d) { err.textContent = "Неверный PIN"; document.getElementById("pin").value = ""; return; }
    ZP = d; zpTouch(); render();
  } catch (x) { err.textContent = "Не удалось открыть: " + x.message; }
}

function zpSum(tab, sel) {
  const rec = ZP.ludi[tab] || {};
  const s = { k: 0, n: 0 }, rows = [];
  sel.forEach((m) => {
    const z = rec[m];
    rows.push({ m, z });
    if (!z) return;
    s.n++;
    Object.entries(z).forEach(([k, v]) => { if (typeof v === "number" && k !== "okl" && k !== "dn" && k !== "h") s[k] = (s[k] || 0) + v; });
  });
  return { s, rows };
}
function barChart(rows, val, label) {
  const vals = rows.map((r) => val(r));
  const mx = Math.max(...vals, 1), n = rows.length, W = 320, H = 120, bw = Math.min(28, (W - 8) / n - 6);
  const bars = rows.map((r, i) => {
    const v = vals[i], h = Math.max(v ? 2 : 0, v / mx * (H - 22)), x = 4 + i * ((W - 8) / n) + ((W - 8) / n - bw) / 2, y = H - 18 - h;
    return `<g><title>${esc(mLabel(r.m))}: ${money(v)} ₸</title><rect x="${x - 3}" y="0" width="${bw + 6}" height="${H}" fill="transparent"/>
      <path d="M${x},${H - 18} V${y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - 18} z" fill="var(--accent)"/>
      <text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="var(--muted)">${MON_S[+r.m.slice(5) - 1]}</text></g>`;
  }).join("");
  return `<div class="card" style="padding:12px 12px 6px"><div class="note" style="margin-bottom:4px">${esc(label)}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(label)}"><line x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}" stroke="var(--line)"/>${bars}</svg></div>`;
}

/* ───── экраны ───── */
function staffRow(s, zp) {
  return `<button class="row" data-go="#emp/${encodeURIComponent(s.tab)}/t">
    <span class="m"><span class="n">${esc(s.fio)}</span><span class="d">${esc(s.dolzh)} · ${esc(s.podr)}</span></span>
    <span class="r">${stBadge(s)}${zp != null ? `<span class="rs num" style="color:var(--muted)">${money(zp)} ₸</span>` : ""}</span>${I.chev}</button>`;
}
function viewStaff(b) {
  if (!DATA) return { top: header("Персонал", "ФИО, должность, подразделение"), main: noData() };
  if (!P() || !P().personal) return { top: header("Персонал", "Поиск"), main: `<div class="card empty">В архиве нет данных по персоналу. Положите в папку на ПК список сотрудников 1С, табель и папку «РПВ» и соберите архив заново.</div>` };
  const mode = b === "dep" ? "dep" : "emp";
  if (b === "abs") staffChip = "abs";
  const seg = `<div class="seg"><button class="${mode === "emp" ? "on" : ""}" data-go="#staff">Сотрудники</button><button class="${mode === "dep" ? "on" : ""}" data-go="#staff/dep">Подразделения</button></div>`;
  const tb = P().tabel;
  const stamp = `<div class="note">По табелю на ${esc(tb ? tb.po : "—")} · список 1С на ${esc(P().personal.na || "—")}</div>`;
  if (mode === "dep") return { top: header("Персонал · подразделения", "Подразделение"), main: seg + viewDeps() };
  const all = people();
  const act = all.filter((s) => !s.uvolen), abs = act.filter(isAbsent), uv = all.filter((s) => s.uvolen);
  const chips = [["all", "Работают · " + act.length], ["abs", "Отсутствуют · " + abs.length], ["uv", "Уволенные · " + uv.length]];
  const base = staffChip === "abs" ? abs : staffChip === "uv" ? uv : act;
  const list = base.filter((s) => match(Q, s.fio, s.dolzh, s.podr, s.tab));
  let body;
  if (staffChip === "abs" && !Q) {
    const g = {};
    list.forEach((s) => { const k = ABS[s.status.kod][0]; (g[k] = g[k] || []).push(s); });
    body = Object.entries(g).map(([k, l]) => `<div class="h2">${esc(k)} · ${l.length}</div>` + l.map((s) => staffRow(s)).join("")).join("") || `<div class="empty">Никто не отсутствует</div>`;
  } else body = list.slice(0, 200).map((s) => staffRow(s)).join("") || `<div class="empty">Ничего не найдено</div>`;
  return {
    top: header("Персонал", "ФИО, должность, подразделение"),
    main: seg + `<div class="chips scroll">${chips.map(([k, l]) => `<button class="chip ${staffChip === k ? "on" : ""}" data-schip="${k}">${l}</button>`).join("")}</div>` +
      stamp + (Q ? `<div class="note" style="font-weight:700">Найдено: ${list.length}</div>` : "") + body
  };
}

function depStats() {
  const m = {};
  (P().personal.podrazdeleniya || []).forEach((d) => { m[d] = { name: d, n: 0, abs: 0, ppl: [] }; });
  people().filter((s) => !s.uvolen).forEach((s) => {
    const d = m[s.podr] || (m[s.podr] = { name: s.podr, n: 0, abs: 0, ppl: [] });
    d.n++; d.ppl.push(s); if (isAbsent(s)) d.abs++;
  });
  return Object.values(m);
}
function viewDeps() {
  const deps = depStats().filter((d) => match(Q, d.name));
  let fot = "", sel = [];
  if (ZP) {
    const pp = perPicker("d", ZP.mesyacy); sel = pp.sel;
    const tot = sel.reduce((s, k) => s + (ZP.itogo[k] || 0), 0);
    fot = `<div class="h2">ФОТ (начислено) · ${esc(perText(sel))}</div>${pp.html}<div class="total"><span>Итого по предприятию</span><b class="num">${money(tot)} ₸</b></div>`;
  }
  const rows = deps.map((d) => {
    const f = ZP ? sel.reduce((s, k) => s + ((ZP.podr[k] || {})[d.name] || { k: 0 }).k, 0) : null;
    return `<button class="row" data-go="#dep/${encodeURIComponent(d.name)}"><span class="m"><span class="n">${esc(d.name)}</span>
      <span class="d">${d.n} ${plural(d.n, "человек", "человека", "человек")}${d.abs ? ` · отсутствуют: ${d.abs}` : ""}</span></span>
      ${f != null ? `<span class="r"><span class="rv num">${money(f)} ₸</span></span>` : ""}${I.chev}</button>`;
  }).join("");
  const n = deps.reduce((s, d) => s + d.n, 0);
  return `<div class="total"><span>Численность (1С)</span><b class="num">${n}</b></div>` + (ZP ? fot : lockCard("ФОТ по подразделениям")) + rows;
}

function viewDep(name) {
  const d = depStats().find((x) => x.name === name);
  if (!d) return { top: backbar("Персонал", "Подразделение"), main: `<div class="empty">Нет в текущих данных</div>` };
  let main = `<div class="card kv"><div><span>Численность</span><b>${d.n}</b></div><div><span>Отсутствуют</span><b>${d.abs}</b></div>
    ${SH() ? `<div><span>Свободно по штатке</span><b>${nf0.format(vacOf(name).reduce((s, v) => s + v.vakant, 0))} ед.</b></div>` : ""}</div>`;
  if (ZP) {
    const pp = perPicker("d", ZP.mesyacy), sel = pp.sel;
    const tot = sel.reduce((s, k) => s + ((ZP.podr[k] || {})[name] || { k: 0 }).k, 0);
    main += `<div class="h2">ФОТ · ${esc(perText(sel))}</div>${pp.html}<div class="total"><span>Начислено</span><b class="num">${money(tot)} ₸</b></div>`;
    if (ZP.mesyacy.length > 1) main += barChart(ZP.mesyacy.map((m) => ({ m })), (r) => ((ZP.podr[r.m] || {})[name] || { k: 0 }).k, "ФОТ по месяцам, ₸");
  } else main += lockCard("ФОТ подразделения");
  const vac = vacOf(name);
  const dsel = ZP ? resolvePer(PER.d, ZP.mesyacy) : [];
  const pz = (s) => ZP ? zpSum(s.tab, dsel).s.k : null;
  main += `<div class="h2">Сотрудники · ${d.n}${ZP ? " · начислено за период" : ""}</div>` + d.ppl.sort((a, b) => low(a.fio) < low(b.fio) ? -1 : 1).map((s) => staffRow(s, pz(s))).join("");
  if (vac.length) main += `<div class="h2">Свободно по штатке · ${nf0.format(vac.reduce((s, v) => s + v.vakant, 0))} ед.</div><div class="card shg">${vac.map(vacRow).join("")}</div>`;
  return { top: backbar("Подразделение", name), main };
}

function viewEmp(b) {
  const [tab, t0] = b.split("/");
  const t = t0 || "t";
  const s = emp(tab);
  if (!s) return { top: backbar("Сотрудник", ""), main: `<div class="empty">Нет в текущих данных</div>` };
  const st = s.status;
  const head = `<div class="card kv">
    <div><span>Должность</span><b>${esc(s.dolzh)}</b></div>
    <div><span>Подразделение</span><b><button data-go="#dep/${encodeURIComponent(s.podr)}" class="ok" style="font-weight:800">${esc(s.podr)}</button></b></div>
    ${s.tab.startsWith("f:") ? "" : `<div><span>Табельный №</span><b class="num">${esc(s.tab.replace(/^0+/, ""))}</b></div>`}
    ${s.tab_old ? `<div><span>Прежний таб. №</span><b class="num">${esc(s.tab_old.map((t) => t.replace(/^0+/, "")).join(", "))} · повторный приём</b></div>` : ""}
    ${s.priem ? `<div><span>Принят</span><b class="num">${esc(s.priem)}</b></div>` : ""}
    ${s.oplata ? `<div><span>Оплата</span><b>${esc(s.oplata)}</b></div>` : ""}
    ${s.sovm ? `<div><span>Совмещение</span><b>${esc(s.sovm.dolzh)} · ${esc(s.sovm.podr)}</b></div>` : ""}
    <div><span>Статус по табелю</span><b>${s.uvolen ? "уволен" : st ? (ABS[st.kod] ? ABS[st.kod][0] : st.kod === "в" ? "выходной" : st.kod === "у" ? "уволен" : st.kod) + " · " + esc(st.data) : "работает"}</b></div>
  </div>`;
  const tabs = [["t", "Табель"], ["z", "Зарплата"], ["p", "Приказы"]];
  const seg = `<div class="seg">${tabs.map(([k, l]) => `<button class="${t === k ? "on" : ""}" data-go="#emp/${encodeURIComponent(tab)}/${k}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (t === "t") body = empTabel(s);
  else if (t === "z") body = ZP ? empZp(s) : lockCard("Зарплата");
  else body = empPrik(s);
  return { top: backbar((s.uvolen ? "Уволен · " : "Сотрудник · ") + s.podr, s.fio), main: head + seg + body };
}

function empTabel(s) {
  const T = P().tabel;
  if (!T) return `<div class="empty">Табеля в архиве нет</div>`;
  const months = T.mesyacy.filter((k) => (T.ludi[s.tab] || {})[k]);
  if (!months.length) return `<div class="empty">В табеле этого человека нет</div>`;
  const pp = perPicker("t", months), st = tabelStat(s.tab, pp.sel);
  const absTxt = Object.entries(ABS).map(([c, [l]]) => st.abs[c] ? `<div><span>${l}</span><b class="num">${st.abs[c]} дн.</b></div>` : "").join("");
  // табель 1С (расчётная ведомость, выровнен по 5/2) — только закрытые месяцы
  const t1 = (T.t1c || {})[s.tab] || {};
  const sel1 = pp.sel.filter((k) => t1[k]);
  const c1 = sel1.reduce((a, k) => [a[0] + t1[k][0], a[1] + t1[k][1]], [0, 0]);
  const f1 = pp.sel.filter((k) => t1[k]).length ? tabelStat(s.tab, sel1) : null;
  let h = pp.html + `<div class="card big">
      <div class="l">${esc(perText(pp.sel))}${st.partial ? " · по " + esc(T.po) : ""} · фактически (онлайн-табель)</div>
      <div class="v num">${st.dn} <small style="font-size:15px;color:var(--muted)">дн. · норма ${st.norm[0]}</small></div>
      <div class="note num" style="padding:0">${nf0.format(st.h)} ч из ${st.norm[1]} ч${st.yavka != null ? ` · явка ${st.yavka}%` : ""}</div>
    </div>`;
  if (sel1.length) {
    const dd = f1.dn - c1[0], dh = f1.h - c1[1];
    h += `<div class="card kv">
      <div><span>По табелю 1С${sel1.length < pp.sel.length ? (sel1.length > 2 ? " (закрытые месяцы, по " + mLabel(sel1[sel1.length - 1], true) + ")" : " (" + sel1.map((k) => mLabel(k, true)).join(", ") + ")") : ""}</span><b class="num">${nf0.format(c1[0])} дн. · ${nf0.format(c1[1])} ч</b></div>
      <div><span>Фактически за те же месяцы</span><b class="num">${f1.dn} дн. · ${nf0.format(f1.h)} ч</b></div>
      <div><span>Разница (факт − 1С)</span><b class="num ${dd > 0 || dh > 0 ? "warn" : ""}">${dd > 0 ? "+" : ""}${dd} дн. · ${dh > 0 ? "+" : ""}${nf0.format(dh)} ч</b></div>
    </div>`;
  }
  h += `<div class="card kv">${absTxt || `<div><span>Отпуск, больничный, прогулы</span><b>нет</b></div>`}</div>`;
  if (pp.sel.length === 1) h += calStrip(s.tab, pp.sel[0]) + `<div class="note">Цифры — часы; о — отпуск, б/л — больничный, б/с — без сохранения, н — отсутствие, в — выходной.</div>`;
  else h += `<div class="card tbl"><div class="tr th tr5"><span>Месяц</span><span>Факт дн/ч</span><span>1С дн/ч</span><span>Норма</span><span>Отсутств.</span></div>${st.months.map((r) => {
    const a = Object.entries(r.abs).map(([c, n]) => c + " " + n).join(", ");
    const o = t1[r.k];
    return `<div class="tr tr5"><span>${mLabel(r.k, true)}</span><span class="num ${o && (r.dn > o[0] || r.h > o[1]) ? "warn" : ""}">${r.dn}/${nf0.format(r.h)}</span><span class="num">${o ? o[0] + "/" + nf0.format(o[1]) : "—"}</span><span class="num">${r.norm[0]}</span><span>${esc(a || "—")}</span></div>`;
  }).join("")}</div>`;
  h += `<div class="note">Факт — онлайн-табель по ${esc(T.po)}, все отработанные дни и часы. 1С — дни и часы из расчётной ведомости (выровнены по 5/2), только закрытые месяцы. Явка — доля отработанных дней среди рабочих и пропущенных (отпуск, больничный, б/с, отсутствие).</div>`;
  return h;
}

function empZp(s) {
  const months = ZP.mesyacy;
  const pp = perPicker("z", months), sel = pp.sel;
  const { s: sm, rows } = zpSum(s.tab, sel);
  if (!sm.n) return pp.html + `<div class="empty">За ${esc(perText(sel))} начислений нет</div>`;
  const osn = (sm.ok || 0) + (sm.ch || 0) + (sm.sd || 0);
  let h = pp.html + `<div class="card big">
      <div class="l">Начислено · ${esc(perText(sel))}</div>
      <div class="v num">${money(sm.k)} <small style="font-size:15px;color:var(--muted)">₸</small></div>
      <div class="note num" style="padding:0">основная ${money(osn)} · премии ${money(sm.pr)}${sm.n > 1 ? ` · в среднем ${money(sm.k / sm.n)} в месяц` : ""}</div>
    </div>
    <div class="card kv">${ZPK.filter(([k]) => sm[k]).map(([k, l]) => `<div><span>${l}</span><b class="num">${money(sm[k])}</b></div>`).join("")}</div>`;
  if (rows.length > 1) h += barChart(rows, (r) => r.z ? r.z.k : 0, "Начислено по месяцам, ₸");
  h += `<div class="card tbl"><div class="tr th"><span>Месяц</span><span>Начислено</span><span>Премия</span><span>Дни</span></div>${rows.map((r) =>
    `<div class="tr"><span>${mLabel(r.m, true)}</span><span class="num">${r.z ? money(r.z.k) : "—"}</span><span class="num">${r.z && r.z.pr ? money(r.z.pr) : "—"}</span><span class="num">${r.z && r.z.dn ? r.z.dn : "—"}</span></div>`).join("")}</div>`;
  const lastOkl = rows.slice().reverse().find((r) => r.z && r.z.okl);
  if (lastOkl) h += `<div class="note num">Оклад (тариф) по 1С: ${money(lastOkl.z.okl)}${lastOkl.z.okl < 5000 ? " ₸/час" : " ₸"}</div>`;
  h += `<div class="note">Только закрытые месяцы — по ${esc(mLabel(months[months.length - 1]))}. Источник — расчётная ведомость 1С.</div>`;
  return h;
}

function empPrik(s) {
  const list = ((P().prikazy || {}).ludi || {})[s.tab] || [];
  if (!list.length) return `<div class="empty">Кадровых приказов за год нет</div>`;
  const g = {};
  list.forEach((o) => { const x = g[o.k] = g[o.k] || { n: 0, dn: 0 }; x.n++; x.dn += o.dn || 0; });
  const sum = Object.entries(g).sort((a, b) => b[1].n - a[1].n).map(([k, x]) => `<div><span>${esc(k)}</span><b class="num">${x.n} ${plural(x.n, "раз", "раза", "раз")}${x.dn ? " · " + nf0.format(x.dn) + " дн." : ""}</b></div>`).join("");
  const rows = list.slice().reverse().map((o) => `<div class="firm"><div class="fh"><span>${esc(o.t)}</span><span class="num" style="color:var(--muted);flex:none">№ ${esc(o.n)}</span></div>
    <div class="note num" style="padding:2px 0 0">${esc(o.d || "")}${o.s && o.po && o.s !== o.po ? ` · с ${esc(o.s)} по ${esc(o.po)}` : ""}${o.dn ? ` · ${nf0.format(o.dn)} дн.` : ""}</div></div>`).join("");
  return `<div class="h2">Итого за год</div><div class="card kv">${sum}</div><div class="h2">Приказы · ${list.length}</div><div class="card">${rows}</div>`;
}

/* ───── для Главной и поиска ───── */
function homeAbsent() {
  if (!P() || !P().personal) return "";
  const abs = people().filter(isAbsent);
  const g = {};
  abs.forEach((s) => { const k = ABS[s.status.kod][0]; g[k] = (g[k] || 0) + 1; });
  const txt = Object.entries(g).map(([k, n]) => k.toLowerCase() + " " + n).join(" · ");
  return `<button class="row" data-go="#staff/abs"><span class="m"><span class="n">Сегодня отсутствуют · ${abs.length}</span><span class="d">${esc(txt || "все на месте")} · табель на ${esc(P().tabel ? P().tabel.po : "—")}</span></span>${I.chev}</button>`;
}
function staffSearch(res) {
  people().forEach((s) => match(Q, s.fio, s.dolzh, s.podr) && res.push({ ty: s.uvolen ? "Сотрудник · уволен" : "Сотрудник", t: s.fio, s: `${s.dolzh} · ${s.podr}`, h: "#emp/" + encodeURIComponent(s.tab) + "/t" }));
}

/* ───── события раздела ───── */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-per],[data-schip],[data-unlock]");
  if (!b) return;
  e.stopPropagation();
  if (b.dataset.unlock) { unlock(); return; }
  if (b.dataset.schip) { staffChip = b.dataset.schip; if (location.hash === "#staff/abs") history.replaceState(null, "", "#staff"); render(); return; }
  const [id, f, v] = b.dataset.per.split(":");
  PER[id][f] = v;
  render(true);
}, true);
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-pers]");
  if (!el) return;
  const [id, f] = el.dataset.pers.split(":");
  PER[id].k = "c"; PER[id][f] = el.value;
  render(true);
});

/* ───── вакансии и штатное расписание ───── */
function podrKey(p) { return low(p).replace(/крупяной завод/, "крупозавод").replace(/\s+/g, " ").trim(); }
function vacOf(name) {
  const sh = SH();
  if (!sh) return [];
  return sh.okladniki.concat(sh.sdelshiki).filter((x) => x.vakant > 0 && x.podr1c && podrKey(x.podr1c) === podrKey(name));
}
function shortFio(f) { const w = String(f || "").split(/\s+/); return w[0] + (w[1] ? " " + w[1][0] + "." : "") + (w[2] ? w[2][0] + "." : ""); }
function whoTxt(x) {
  const a = (x.kto || []).map((k) => shortFio(k.f) + (k.d ? " (та же ед., что «" + (x.dubl || "вверху") + "»)" : k.s ? " (совм.)" : ""));
  const d = (x.kto_dekret || []).map((k) => shortFio(k.f) + " (декрет)");
  const all = a.concat(d);
  return all.length ? `<span class="d who">${esc(all.join(", "))}</span>` : "";
}
function occTxt(x) {
  const held = x.ed - x.vakant;
  let t = "занято " + nf0.format(held) + " из " + nf0.format(x.ed);
  if (x.dekret) t += " · в декрете " + x.dekret + (x.zamesh ? ", замещают " + x.zamesh : ", не замещают");
  if (x.sovm) t += " · совмещение " + x.sovm;
  return t;
}
function payTxt(x) { return money(x.oklad) + (x.doplata ? " + " + money(x.doplata) + " премия/KPI" : ""); }
function vacRow(x) {
  const per = x.oklad + (x.doplata || 0);
  return `<div class="shr"><span class="m"><span class="n2">${esc(x.dolzh)}${x.v_tabele ? ` <span class="badge b-info">ищут</span>` : ""}</span>
    <span class="d num">${x.doplata ? payTxt(x) + " = " : ""}${money(per)} ₸ на ед. · ${occTxt(x)}</span>${whoTxt(x)}</span>
    <span class="r2"><span class="num rv2 bad">${nf0.format(x.vakant)} ед.</span><span class="d num">${money(per * x.vakant)} ₸</span></span></div>`;
}
function SH() { return P() && P().shtat ? P().shtat : null; }
function edTxt(x) { return nf0.format(x) + " ед."; }

function viewShtat(b) {
  const top = (sub) => backbar("Штатка" + (SH() ? " на " + SH().data : ""), sub);
  if (!SH()) return { top: top("Штатное расписание"), main: `<div class="card empty">Штатного расписания в архиве нет. Положите файл «…штатное расписание…» в папку «Данные» на ПК и соберите архив заново.</div>` };
  const sh = SH(), tab = b || "okl";
  const okl = sh.okladniki, sd = sh.sdelshiki;
  const sum = (l, k) => l.reduce((s, x) => s + (x[k] || 0), 0);
  const vO = okl.filter((x) => x.vakant > 0), vS = sd.filter((x) => x.vakant > 0);
  const fotVac = (l) => l.reduce((s, x) => s + (x.oklad + (x.doplata || 0)) * x.vakant, 0);
  const head = `<div class="tiles">
      <button class="tile" data-go="#shtat/okl"><span class="l">Окладники</span><span class="v num">${nf0.format(sum(okl, "ed"))} <small>ед.</small></span><span class="s num">занято ${nf0.format(sum(okl, "ed") - sum(okl, "vakant"))} · ${money(sum(okl, "mes"))} ₸/мес</span></button>
      <button class="tile" data-go="#shtat/sdel"><span class="l">Сдельщики</span><span class="v num">${nf0.format(sum(sd, "ed"))} <small>ед.</small></span><span class="s num">занято ${nf0.format(sum(sd, "ed") - sum(sd, "vakant"))} · ${money(sum(sd, "mes"))} ₸/мес</span></button>
    </div>
    <button class="row" data-go="#shtat/vac"><span class="m"><span class="n">Свободно по штатке · ${nf0.format(sum(vO, "vakant") + sum(vS, "vakant"))} ед.</span><span class="d">окладники ${nf0.format(sum(vO, "vakant"))} · сдельщики ${nf0.format(sum(vS, "vakant"))}</span></span>${I.chev}</button>`;
  const seg = `<div class="seg">${[["okl", "Окладники"], ["sdel", "Сдельщики"], ["vac", "Вакансии"]].map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-go="#shtat/${k}">${l}</button>`).join("")}</div>`;
  const srch = `<label class="search">${I.search}<input id="q" type="search" enterkeyhint="search" aria-label="Поиск" placeholder="Должность или подразделение" value="${esc(Q)}" autocomplete="off"><button class="iconbtn" id="qx" style="width:40px;height:40px;color:var(--muted);${Q ? "" : "display:none"}" aria-label="Очистить поиск" data-act="clearq">${I.x}</button></label>`;
  const grpOf = (x) => x.podr || x.uchastok;
  const groupBy = (list) => { const g = new Map(); list.forEach((x) => { const k = grpOf(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }); return g; };
  let body = "";
  if (tab === "okl" || tab === "sdel") {
    const list = (tab === "okl" ? okl : sd).filter((x) => match(Q, x.dolzh, grpOf(x), x.blok || ""));
    body = [...groupBy(list).entries()].map(([k, l]) => {
      const sub = tab === "okl" && l[0].blok !== k ? l[0].blok + " · " : "";
      return `<div class="card shg"><div class="shh"><span class="m"><span class="n">${esc(k)}</span><span class="d num">${esc(sub)}${edTxt(sum(l, "ed"))}, занято ${nf0.format(sum(l, "ed") - sum(l, "vakant"))} · ${money(sum(l, "mes"))} ₸/мес</span></span></div>
        ${l.map((x) => `<div class="shr"><span class="m"><span class="n2">${esc(x.dolzh)}</span><span class="d num">${x.ed > 1 ? edTxt(x.ed) + " × " : ""}${payTxt(x)}</span>${whoTxt(x)}</span>
          <span class="r2"><span class="num rv2">${money(x.mes)}</span><span class="d num ${x.vakant > 0 ? "bad" : x.vremenno ? "warn" : "ok"}">${x.vakant > 0 ? "свободно " + nf0.format(x.vakant) : x.vremenno ? "в декрете, не замещают" : "занято"}</span>${x.dekret && x.zamesh ? `<span class="d" style="color:var(--muted)">декрет · замещают</span>` : ""}</span></div>`).join("")}
      </div>`;
    }).join("") || `<div class="empty">Ничего не найдено</div>`;
    body = `<div class="total"><span>${tab === "okl" ? "Окладники" : "Сдельщики (по 50 кг)"}${Q ? " · найдено" : ""}</span><b class="num">${edTxt(sum(list, "ed"))} · ${money(sum(list, "mes"))} ₸</b></div>` + body +
      `<div class="note">${tab === "okl" ? "В месяц = (оклад + премия/KPI по штатке) × ед." : "Оклад по штатке = норма × действующий тариф (у элеваторов и служб — средняя зарплата)."} «Занято» — сотрудники из 1С, сопоставленные с должностью по названию и подразделению.</div>`;
  } else {
    const blk = (title, l) => {
      const f = l.filter((x) => match(Q, x.dolzh, grpOf(x)));
      if (!f.length) return `<div class="h2">${title}</div><div class="card empty" style="padding:14px">Нет</div>`;
      return `<div class="h2">${title} · ${nf0.format(sum(f, "vakant"))} ед. · ${money(fotVac(f))} ₸/мес</div>` +
        [...groupBy(f).entries()].map(([k, g]) => `<div class="card shg"><div class="shh"><span class="m"><span class="n">${esc(k)}</span><span class="d num">свободно ${edTxt(sum(g, "vakant"))} · ${money(fotVac(g))} ₸/мес</span></span></div>${g.map(vacRow).join("")}</div>`).join("");
    };
    body = blk("Окладники", vO) + blk("Сдельщики", vS);
    const vr = okl.concat(sd).filter((x) => x.vremenno > 0 && match(Q, x.dolzh, grpOf(x)));
    if (vr.length) body += `<div class="h2">Временно не работает никто · ${nf0.format(sum(vr, "vremenno"))} ед.</div><div class="card shg">${vr.map((x) => `<div class="shr"><span class="m"><span class="n2">${esc(x.dolzh)}</span><span class="d">${esc(grpOf(x))} · сотрудник в декрете / по уходу за ребёнком, место за ним</span></span><span class="r2"><span class="num rv2 warn">${nf0.format(x.vremenno)} ед.</span><span class="d num">${money(x.oklad + (x.doplata || 0))} ₸</span></span></div>`).join("")}</div>`;
    const tl = sh.tabel_lishnie || [], sv = sh.sverh_shtata || [];
    if (tl.length) body += `<div class="h2">В табеле — вакансия, а по 1С занято</div><div class="card kv">${tl.map((v) => `<div><span>${esc(v.dolzh)}</span><b>${esc(v.podr)}</b></div>`).join("")}</div><div class="note">Эти строки «ВАКАНСИЯ» в табеле, вероятно, устарели — должность уже занята (или её нет в штатке).</div>`;
    const svM = sv.filter((v) => !v.sovm), svS = sv.filter((v) => v.sovm);
    if (svM.length) body += `<div class="h2">Работают сверх штата / нет в штатке</div><div class="card kv">${svM.map((v) => `<div><span>${esc(shortFio(v.fio))}</span><b>${esc(v.dolzh)} · ${esc(v.podr)}</b></div>`).join("")}</div>`;
    if (svS.length) body += `<div class="h2">Совмещения, для которых нет свободной ед.</div><div class="card kv">${svS.map((v) => `<div><span>${esc(shortFio(v.fio))}</span><b>${esc(v.dolzh)} · ${esc(v.podr)}</b></div>`).join("")}</div><div class="note">По табелю человек совмещает, но все ед. этой должности уже заняты основными работниками (или совмещают несколько человек на одной ед.).</div>`;
    body += `<div class="note">Свободно = ед. по штатке − работающие (в т. ч. по совмещению из табеля и файла «Совмещения») − сотрудники в декрете/по уходу за ребёнком (место за ними сохраняется; кто работает на их месте — «замещают»). «Ищут» — по должности есть строка «ВАКАНСИЯ» в табеле. Сумма — оклад + премия/KPI на свободные ед. в месяц.</div>`;
  }
  return { top: top(tab === "okl" ? "Окладники" : tab === "sdel" ? "Сдельщики" : "Вакансии") + `<div style="padding:0 16px 8px">${srch}</div>`, main: head + seg + body };
}
